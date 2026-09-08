import time
import threading
import logging
from typing import Dict, Any, List, Optional
from app.ml.train_yolo import train_yolo_model

logger = logging.getLogger(__name__)

class TrainingServiceManager:
    """
    Background Training Service executing YOLO model fine-tuning jobs asynchronously.
    Prevents thread locking on the main FastAPI event loop.
    """
    def __init__(self):
        self._lock = threading.Lock()
        self.status: str = "IDLE"  # IDLE, TRAINING, COMPLETED, FAILED
        self.progress_pct: float = 0.0
        self.current_epoch: int = 0
        self.total_epochs: int = 0
        self.model_name: str = "yolo11s.pt"
        self.best_weights: Optional[str] = None
        self.logs: List[str] = []
        self.last_error: Optional[str] = None

    def get_status(self) -> Dict[str, Any]:
        with self._lock:
            return {
                "status": self.status,
                "progress_pct": round(self.progress_pct, 1),
                "current_epoch": self.current_epoch,
                "total_epochs": self.total_epochs,
                "model_name": self.model_name,
                "best_weights": self.best_weights,
                "logs_tail": self.logs[-5:] if self.logs else [],
                "last_error": self.last_error
            }

    def start_training_job(
        self,
        model_name: str = "yolo11s.pt",
        epochs: int = 50,
        batch_size: int = 16,
        device: str = "auto",
        dry_run: bool = False
    ) -> Dict[str, Any]:
        with self._lock:
            if self.status == "TRAINING":
                return {
                    "status": "error",
                    "message": "A training job is already actively running.",
                    "job_status": self.get_status()
                }
            
            self.status = "TRAINING"
            self.progress_pct = 0.0
            self.current_epoch = 0
            self.total_epochs = epochs
            self.model_name = model_name
            self.last_error = None
            self.logs = [f"[{time.strftime('%H:%M:%S')}] Job initialized: model={model_name}, epochs={epochs}, device={device}"]

        # Launch background worker thread
        thread = threading.Thread(
            target=self._run_training_worker,
            args=(model_name, epochs, batch_size, device, dry_run),
            daemon=True
        )
        thread.start()

        return {
            "status": "started",
            "message": f"Training job initiated for model {model_name}",
            "job_status": self.get_status()
        }

    def _run_training_worker(
        self, 
        model_name: str, 
        epochs: int, 
        batch_size: int, 
        device: str, 
        dry_run: bool
    ):
        try:
            self._add_log(f"Starting training pipeline on device '{device}'...")
            
            if dry_run:
                # Simulate progressive epochs for dry-run verification
                for ep in range(1, epochs + 1):
                    time.sleep(0.1)
                    with self._lock:
                        self.current_epoch = ep
                        self.progress_pct = round((ep / epochs) * 100.0, 1)
                    self._add_log(f"Epoch {ep}/{epochs} completed - Loss: {0.45 - (ep * 0.005):.4f}")
                
                result = train_yolo_model(
                    model_name=model_name,
                    epochs=epochs,
                    batch_size=batch_size,
                    device=device,
                    dry_run=True
                )
            else:
                result = train_yolo_model(
                    model_name=model_name,
                    epochs=epochs,
                    batch_size=batch_size,
                    device=device,
                    dry_run=False
                )

            with self._lock:
                self.status = "COMPLETED"
                self.progress_pct = 100.0
                self.current_epoch = epochs
                self.best_weights = result.get("best_weights")
            self._add_log("Training job completed successfully. Weights saved.")

        except Exception as e:
            logger.error(f"[TrainingServiceManager] Worker error: {e}")
            with self._lock:
                self.status = "FAILED"
                self.last_error = str(e)
            self._add_log(f"Job failed with error: {e}")

    def _add_log(self, msg: str):
        timestamp = time.strftime('%H:%M:%S')
        with self._lock:
            self.logs.append(f"[{timestamp}] {msg}")

# Global singleton instance
training_service = TrainingServiceManager()
