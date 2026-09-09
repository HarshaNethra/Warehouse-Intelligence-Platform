export interface VideoMetadata {
  video_id: string;
  camera_id?: string;
  filename?: string;
  frame_count: number;
  fps: number;
  width: number;
  height: number;
  duration: number; // in seconds
  file_size?: number;
  status?: string;
  created_at?: string;
}
