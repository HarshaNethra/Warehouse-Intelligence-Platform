import os
import json
import numpy as np
from typing import List, Dict, Any

try:
    import chromadb
    from chromadb.config import Settings
    CHROMADB_AVAILABLE = True
except ImportError:
    CHROMADB_AVAILABLE = False


class RAGVectorStore:
    """
    ChromaDB & Embedded RAG Vector Store Service.
    Persists incident metadata embeddings to local vector database for AI Assistant queries.
    """
    def __init__(self, db_dir: str = "./chroma_db"):
        self.db_dir = db_dir
        self.collection = None
        self.in_memory_docs: List[Dict[str, Any]] = []

        if CHROMADB_AVAILABLE:
            try:
                os.makedirs(self.db_dir, exist_ok=True)
                self.client = chromadb.PersistentClient(path=self.db_dir)
                self.collection = self.client.get_or_create_collection(
                    name="warehouse_incidents",
                    metadata={"hnsw:space": "cosine"}
                )
                print(f"[RAGVectorStore] Loaded persistent ChromaDB collection at: {self.db_dir}")
            except Exception as e:
                print(f"[RAGVectorStore] ChromaDB initialization warning ({e}). Running in Embedded Vector Store mode.")
        else:
            print("[RAGVectorStore] ChromaDB package not installed. Running in Embedded Vector Store Mode.")

        # Seed initial incident benchmarks if empty
        self._seed_initial_benchmarks()

    def _seed_initial_benchmarks(self):
        initial_incidents = [
            {
                "event_id": "EVT-101",
                "behaviour": "Package Stepping & Improper Heavy Stacking",
                "bay_id": "Loading Bay 3",
                "risk_score": 96.1,
                "risk_level": "Critical",
                "description": "Heavy box stacked on top of KD flatpacks + operator stepping on cartons in Loading Bay 3.",
                "reason": "Vertical stack overhang ratio > 1.4x + COCO Pose Keypoint #15/#16 ankle containment inside carton box."
            },
            {
                "event_id": "EVT-102",
                "behaviour": "Product Dropped from 1.2m Height",
                "bay_id": "Loading Bay 1",
                "risk_score": 85.2,
                "risk_level": "High",
                "description": "Vertical impact acceleration spike measured at 11.5 m/s² during manual vehicle unloading.",
                "reason": "Kinematics engine recorded freefall Y-acceleration ay = 11.5 m/s² > 8.0 m/s² threshold."
            },
            {
                "event_id": "EVT-103",
                "behaviour": "Carton Dragging on Wet Floor",
                "bay_id": "Loading Bay 2",
                "risk_score": 78.8,
                "risk_level": "High",
                "description": "Continuous carton dragging translation velocity v = 1.8 m/s on wet concrete floor.",
                "reason": "Kinematic translation vector vx = 1.8 m/s sustained over 2.5 seconds."
            }
        ]
        for inc in initial_incidents:
            self.add_incident(inc)

    def add_incident(
        self, 
        event_dict: Optional[Dict[str, Any]] = None, 
        incident_id: Optional[str] = None, 
        summary_text: Optional[str] = None, 
        metadata: Optional[Dict[str, Any]] = None,
        **kwargs
    ) -> None:
        """
        Embeds and stores an incident document in ChromaDB / Vector Store.
        Supports both event_dict and keyword arguments (incident_id, summary_text, metadata).
        """
        if event_dict is None:
            event_dict = {}

        event_id = incident_id or event_dict.get("event_id", f"EVT-{len(self.in_memory_docs)+1}")
        
        if summary_text:
            document_text = summary_text
        else:
            document_text = f"{event_dict.get('behaviour', 'Safety Incident')} detected in {event_dict.get('bay_id', 'Loading Bay')}. {event_dict.get('description', '')} {event_dict.get('reason', '')}".strip()

        meta_dict = metadata or {
            "event_id": event_id,
            "facility_id": str(event_dict.get("facility_id", "FAC-001")),
            "bay_id": str(event_dict.get("bay_id", "Bay 1")),
            "behaviour": str(event_dict.get("behaviour", "Violation")),
            "risk_score": float(event_dict.get("risk_score", 85.0)),
            "risk_level": str(event_dict.get("risk_level", "High")),
        }

        self.in_memory_docs.append({
            "id": event_id,
            "text": document_text,
            "metadata": meta_dict
        })

        if self.collection is not None:
            try:
                self.collection.upsert(
                    ids=[event_id],
                    documents=[document_text],
                    metadatas=[meta_dict]
                )
            except Exception as e:
                print(f"[RAGVectorStore] ChromaDB upsert warning: {e}")

    def query_incidents(self, query_text: str, n_results: int = 3, facility_id: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        Performs vector similarity search over stored incident records, filtered by facility_id.
        """
        if self.collection is not None:
            try:
                where_clause = {"facility_id": facility_id} if facility_id else None
                results = self.collection.query(
                    query_texts=[query_text],
                    n_results=n_results,
                    where=where_clause
                )
                formatted = []
                if results and "documents" in results and results["documents"]:
                    docs = results["documents"][0]
                    metas = results["metadatas"][0] if "metadatas" in results else [{}] * len(docs)
                    for d, m in zip(docs, metas):
                        formatted.append({
                            "text": d,
                            "metadata": m
                        })
                return formatted
            except Exception as e:
                print(f"[RAGVectorStore] ChromaDB query error: {e}")

        # Embedded Fallback Keyword Vector Matching
        q_clean = query_text.lower()
        scored = []
        for doc in self.in_memory_docs:
            if facility_id and doc.get("metadata", {}).get("facility_id") not in [None, facility_id]:
                continue
            score = sum(1 for word in q_clean.split() if word in doc["text"].lower())
            scored.append((score, doc))

        scored.sort(key=lambda x: x[0], reverse=True)
        return [{"text": doc["text"], "metadata": doc["metadata"]} for _, doc in scored[:n_results]]

    def delete_incidents(self, incident_ids: List[str]) -> None:
        """
        Deletes matching incident vector embeddings from both ChromaDB collection and in-memory docs.
        """
        if not incident_ids:
            return

        id_set = set(incident_ids)
        self.in_memory_docs = [doc for doc in self.in_memory_docs if doc.get("id") not in id_set]

        if self.collection is not None:
            try:
                self.collection.delete(ids=incident_ids)
                print(f"[RAGVectorStore] Deleted {len(incident_ids)} incident embeddings from ChromaDB.")
            except Exception as e:
                print(f"[RAGVectorStore] ChromaDB delete warning: {e}")

    def query_similar_incidents(self, query_text: str, n_results: int = 3) -> List[Dict[str, Any]]:
        """
        Alias for query_incidents to comply with IncidentVectorStore interface.
        """
        return self.query_incidents(query_text=query_text, n_results=n_results)


# Alias class for IncidentVectorStore
IncidentVectorStore = RAGVectorStore

# Singleton Vector Store Instance
rag_vector_store = RAGVectorStore()
