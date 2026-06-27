"""
Test script for Campaign and Queue System flow.
"""
import sys
import os
from datetime import datetime, timedelta

# Add backend directory to path
sys.path.append(os.path.join(os.path.dirname(__file__), "..", "backend"))

from database.connection import SessionLocal
from models.models import Contact, Campaign, MessageJob, CampaignStatus, JobStatus
from models.schemas import CampaignCreate
from services import queue_service, whatsapp_service

def run_test():
    print("Starting Queue System End-to-End Test...")
    db = SessionLocal()
    try:
        # 1. Setup a test contact
        test_phone = "+919999999999"
        contact = db.query(Contact).filter(Contact.phone == test_phone).first()
        if not contact:
            contact = Contact(
                name="Test John Doe",
                phone=test_phone,
                email="john@example.com",
                notes="VIP Client",
                is_active=True
            )
            db.add(contact)
            db.commit()
            db.refresh(contact)
            print(f"Created test contact: {contact.name}")
        else:
            print(f"Using existing contact: {contact.name}")

        # 2. Simulate WhatsApp connection
        whatsapp_service.simulate_connected(db, phone="+918888888888")
        print("Simulated WhatsApp session connected")

        # 3. Define campaign details
        # Let's delete previous test campaigns/jobs to prevent duplicate contact unique constraints in test
        old_campaigns = db.query(Campaign).filter(Campaign.name.like("Test Queue Campaign%")).all()
        for oc in old_campaigns:
            db.delete(oc)
        db.commit()
        print("Cleaned up old test campaigns")

        campaign_data = CampaignCreate(
            name="Test Queue Campaign",
            delay_seconds=10,
            concurrency=2,
            contacts=[contact.id],
            template="Hello {{name}}, this is a scheduled test. Your notes say: {{notes}}.",
            scheduled_at=datetime.utcnow() - timedelta(minutes=1) # scheduled in the past to trigger immediately
        )

        # 4. Create Campaign
        campaign = queue_service.create_campaign(db, campaign_data)
        print(f"Campaign created: {campaign.name} (ID: {campaign.id}), Total Jobs: {campaign.total_jobs}")

        # Verify job was created and interpolated
        job = db.query(MessageJob).filter(MessageJob.campaign_id == campaign.id).first()
        assert job is not None, "Job was not created"
        print(f"Job scheduled_at: {job.scheduled_at}")
        print(f"Job body (interpolated): {job.body}")
        assert "Test John Doe" in job.body, "Name not interpolated"
        assert "VIP Client" in job.body, "Notes not interpolated"
        assert job.status == JobStatus.queued, f"Job status is {job.status}, expected queued"

        # 5. Process queue
        print("Running process_due_jobs...")
        queue_service.process_due_jobs(db)

        # 6. Verify result
        db.refresh(job)
        db.refresh(campaign)
        print(f"After processing - Job status: {job.status}")
        print(f"After processing - Campaign completed jobs: {campaign.completed_jobs}, status: {campaign.status}")

        assert job.status == JobStatus.sent, f"Expected Job status to be sent, got {job.status}"
        assert campaign.completed_jobs == 1, f"Expected 1 completed job, got {campaign.completed_jobs}"
        assert campaign.status == CampaignStatus.completed, f"Expected campaign to be completed, got {campaign.status}"

        print("SUCCESS: Campaign Queue System End-to-End Flow test passed!")

    except Exception as e:
        print(f"FAILED: Test error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    finally:
        db.close()

if __name__ == "__main__":
    run_test()
