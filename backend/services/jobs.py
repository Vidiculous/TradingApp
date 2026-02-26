import uuid
from datetime import datetime, timedelta
from typing import Any


class JobManager:
    def __init__(self):
        self.jobs: dict[str, dict[str, Any]] = {}

    def create_job(self) -> str:
        self.cleanup_old_jobs()
        job_id = str(uuid.uuid4())
        self.jobs[job_id] = {
            "id": job_id,
            "status": "pending",
            "created_at": datetime.now().isoformat(),
            "result": None,
            "error": None,
        }
        return job_id

    def update_job(
        self, job_id: str, status: str, result: Any | None = None, error: str | None = None
    ):
        if job_id in self.jobs:
            self.jobs[job_id]["status"] = status
            if result:
                self.jobs[job_id]["result"] = result
            if error:
                self.jobs[job_id]["error"] = error
            self.jobs[job_id]["updated_at"] = datetime.now().isoformat()

    def get_job(self, job_id: str) -> dict[str, Any] | None:
        return self.jobs.get(job_id)

    def cleanup_old_jobs(self, max_age_seconds=3600):
        cutoff = datetime.now() - timedelta(seconds=max_age_seconds)
        expired = [
            job_id
            for job_id, job in self.jobs.items()
            if datetime.fromisoformat(job["created_at"]) < cutoff
        ]
        for job_id in expired:
            del self.jobs[job_id]


# Global instance
job_manager = JobManager()
