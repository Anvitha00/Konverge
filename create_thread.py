"""
Helper script to create chat threads via API
Usage: python create_thread.py
"""

import requests
import json

API_URL = "http://localhost:8000/api"


def create_thread(title: str, participant_ids: list):
    """Create a new chat thread"""
    url = f"{API_URL}/threads"
    data = {"title": title, "participant_ids": participant_ids}

    response = requests.post(url, json=data)

    if response.status_code == 200:
        thread = response.json()["thread"]
        print(f"✅ Thread created successfully!")
        print(f"   Thread ID: {thread['thread_id']}")
        print(f"   Title: {thread['title']}")
        return thread
    else:
        print(f"❌ Error creating thread: {response.text}")
        return None


def get_user_threads(user_id: int):
    """Get all threads for a user"""
    url = f"{API_URL}/threads/{user_id}"
    response = requests.get(url)

    if response.status_code == 200:
        threads = response.json()["threads"]
        print(f"\n📝 Threads for User {user_id}:")
        for thread in threads:
            print(
                f"   - Thread {thread['thread_id']}: {thread.get('title', 'Untitled')}"
            )
            print(f"     Participants: {len(thread['participants'])}")
            print(f"     Unread: {thread['unread_count']}")
        return threads
    else:
        print(f"❌ Error fetching threads: {response.text}")
        return []


def main():
    print("🚀 Chat Thread Creator\n")

    # Example: Create a thread between user 1 and user 2
    print("Creating a thread between User 1 and User 2...")
    create_thread(title="Project Collaboration", participant_ids=[1, 2])

    print("\n" + "=" * 50 + "\n")

    # Example: Create a group thread
    print("Creating a group thread...")
    create_thread(title="Team Discussion", participant_ids=[1, 2, 3])

    print("\n" + "=" * 50 + "\n")

    # Fetch threads for user 1
    get_user_threads(1)

    print("\n" + "=" * 50 + "\n")

    # Fetch threads for user 2
    get_user_threads(2)


if __name__ == "__main__":
    try:
        main()
    except requests.exceptions.ConnectionError:
        print("❌ Error: Could not connect to the API server.")
        print("   Make sure the FastAPI server is running on http://localhost:8000")
    except Exception as e:
        print(f"❌ Error: {e}")
