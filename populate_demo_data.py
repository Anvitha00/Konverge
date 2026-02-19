#!/usr/bin/env python3
"""
Synthetic Data Population Script for Konverge Demo
Creates realistic user analytics data including:
- Project collaborations based on skills
- Engagement history (last 30 days)
- Rating progress (last 6 months)
- Application statistics
- Skill distributions
"""

import psycopg2
from psycopg2.extras import RealDictCursor
from datetime import datetime, timedelta
import random
from typing import List, Dict, Tuple
import json

def get_db_connection():
    return psycopg2.connect(
        host="localhost",
        port=5432,
        database="konverge",
        user="postgres",
        password="postgres123",
    )

def get_all_users() -> List[Dict]:
    """Get all users from the database"""
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    
    cursor.execute("SELECT user_id, name, email, skills, rating, engagement_score FROM users")
    users = cursor.fetchall()
    
    cursor.close()
    conn.close()
    return [dict(user) for user in users]

def get_all_projects() -> List[Dict]:
    """Get all projects from the database"""
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    
    cursor.execute("SELECT project_id, title, required_skills, owner_id FROM projects")
    projects = cursor.fetchall()
    
    cursor.close()
    conn.close()
    return [dict(project) for project in projects]

def calculate_skill_match_score(user_skills: List[str], project_skills: List[str]) -> float:
    """Calculate skill match score between user and project"""
    if not user_skills or not project_skills:
        return 0.0
    
    user_skills_set = set(skill.lower() for skill in user_skills)
    project_skills_set = set(skill.lower() for skill in project_skills)
    
    if not project_skills_set:
        return 0.0
    
    common_skills = user_skills_set.intersection(project_skills_set)
    match_score = len(common_skills) / len(project_skills_set)
    
    return round(match_score * 100, 2)

def create_project_collaborations():
    """Create project collaborations based on skill matching"""
    print("🔗 Creating project collaborations...")
    
    users = get_all_users()
    projects = get_all_projects()
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    collaborations_created = 0
    
    for user in users:
        # Find best matching projects for this user
        user_skills = user.get('skills', [])
        if not user_skills:
            user_skills = ['JavaScript', 'Python', 'React']  # Default skills
        
        project_matches = []
        for project in projects:
            # Skip if user is the owner
            if project['project_id'] == user['user_id']:
                continue
            
            # Check if already collaborating
            cursor.execute(
                """
                SELECT COUNT(*) FROM project_collaborators 
                WHERE user_id = %s AND project_id = %s
                """,
                (user['user_id'], project['project_id'])
            )
            if cursor.fetchone()[0] > 0:
                continue
            
            # Calculate match score
            project_skills = project.get('required_skills', [])
            match_score = calculate_skill_match_score(user_skills, project_skills)
            
            if match_score > 30:  # Minimum 30% skill match
                project_matches.append({
                    'project_id': project['project_id'],
                    'match_score': match_score,
                    'required_skill': next((skill for skill in project_skills if skill.lower() in [s.lower() for s in user_skills]), user_skills[0])
                })
        
        # Sort by match score and take top 2-3 projects
        project_matches.sort(key=lambda x: x['match_score'], reverse=True)
        selected_projects = project_matches[:random.randint(2, 3)]
        
        # Create collaborations
        for project_match in selected_projects:
            # Random join date in the last 6 months
            days_ago = random.randint(1, 180)
            joined_at = datetime.now() - timedelta(days=days_ago)
            
            cursor.execute(
                """
                INSERT INTO project_collaborators 
                (project_id, user_id, required_skill, status, joined_at)
                VALUES (%s, %s, %s, %s, %s)
                ON CONFLICT (project_id, user_id) DO NOTHING
                """,
                (
                    project_match['project_id'],
                    user['user_id'],
                    project_match['required_skill'],
                    random.choice(['active', 'completed']),
                    joined_at
                )
            )
            collaborations_created += 1
    
    conn.commit()
    cursor.close()
    conn.close()
    
    print(f"✅ Created {collaborations_created} project collaborations")

def create_engagement_history():
    """Create engagement history for the last 30 days"""
    print("📈 Creating engagement history...")
    
    users = get_all_users()
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    engagement_records = 0
    
    for user in users:
        base_score = user.get('engagement_score', 50)
        
        # Create engagement records for the last 30 days
        for days_ago in range(30, 0, -1):
            # Random chance of activity (higher for more active users)
            activity_chance = min(0.8, base_score / 100)
            
            if random.random() < activity_chance:
                # Random engagement points
                points = random.randint(5, 25)
                
                # Random engagement reason
                reasons = [
                    'project_update', 'skill_contribution', 'collaboration',
                    'mentorship', 'code_review', 'documentation', 'feedback'
                ]
                reason = random.choice(reasons)
                
                engagement_date = datetime.now() - timedelta(days=days_ago)
                
                cursor.execute(
                    """
                    INSERT INTO engagement 
                    (user_id, points, reason, timestamp)
                    VALUES (%s, %s, %s, %s)
                    """,
                    (user['user_id'], points, reason, engagement_date)
                )
                engagement_records += 1
    
    conn.commit()
    cursor.close()
    conn.close()
    
    print(f"✅ Created {engagement_records} engagement records")

def create_rating_progress():
    """Create rating progress over the last 6 months"""
    print("⭐ Creating rating progress...")
    
    users = get_all_users()
    projects = get_all_projects()
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    ratings_created = 0
    
    for user in users:
        base_rating = float(user.get('rating', 3.5))
        
        # Create rating history for the last 6 months
        for months_ago in range(6, 0, -1):
            # Random number of ratings this month
            num_ratings = random.randint(1, 3)
            
            for _ in range(num_ratings):
                # Find projects user collaborated on
                cursor.execute(
                    """
                    SELECT DISTINCT pc.project_id, p.owner_id
                    FROM project_collaborators pc
                    JOIN projects p ON pc.project_id = p.project_id
                    WHERE pc.user_id = %s AND pc.project_id != %s
                    LIMIT 5
                    """,
                    (user['user_id'], user['user_id'])
                )
                projects_result = cursor.fetchall()
                
                if projects_result:
                    project_id, rater_id = random.choice(projects_result)
                    
                    # Rating should gradually improve over time
                    rating_variation = random.uniform(-0.3, 0.5)
                    rating = max(2.0, min(5.0, base_rating + rating_variation - (months_ago * 0.1)))
                    
                    completed_date = datetime.now() - timedelta(days=months_ago * 30)
                    created_date = completed_date - timedelta(days=random.randint(1, 15))
                    
                    cursor.execute(
                        """
                        INSERT INTO user_ratings 
                        (project_id, rater_id, ratee_id, score, status, created_at, completed_at)
                        VALUES (%s, %s, %s, %s, %s, %s, %s)
                        ON CONFLICT (project_id, rater_id, ratee_id) DO NOTHING
                        """,
                        (
                            project_id,
                            rater_id,
                            user['user_id'],
                            round(rating, 1),
                            'completed',
                            created_date,
                            completed_date
                        )
                    )
                    ratings_created += 1
    
    conn.commit()
    cursor.close()
    conn.close()
    
    print(f"✅ Created {ratings_created} rating records")

def create_application_statistics():
    """Create project application statistics"""
    print("📋 Creating application statistics...")
    
    users = get_all_users()
    projects = get_all_projects()
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    applications_created = 0
    
    for user in users:
        user_skills = user.get('skills', ['JavaScript', 'Python'])
        
        # Apply to 5-10 projects
        num_applications = random.randint(5, 10)
        
        # Select random projects (excluding user's own projects)
        available_projects = [p for p in projects if p['owner_id'] != user['user_id']]
        selected_projects = random.sample(
            available_projects, 
            min(num_applications, len(available_projects))
        )
        
        for project in selected_projects:
            # Calculate skill match
            project_skills = project.get('required_skills', [])
            match_score = calculate_skill_match_score(user_skills, project_skills)
            
            # Random decision with bias towards acceptance for high match scores
            if match_score > 70:
                decision_weights = {'accepted': 0.6, 'rejected': 0.2, 'pending': 0.2}
            elif match_score > 40:
                decision_weights = {'accepted': 0.3, 'rejected': 0.4, 'pending': 0.3}
            else:
                decision_weights = {'accepted': 0.1, 'rejected': 0.6, 'pending': 0.3}
            
            decision = random.choices(
                list(decision_weights.keys()),
                weights=list(decision_weights.values())
            )[0]
            
            # Random skill from project requirements
            required_skill = random.choice(project_skills) if project_skills else user_skills[0]
            
            cursor.execute(
                """
                INSERT INTO project_matches 
                (project_id, recommended_user_id, required_skill, skill_match_score, 
                 owner_decision, source_type, created_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (project_id, recommended_user_id, required_skill) DO NOTHING
                """,
                (
                    project['project_id'],
                    user['user_id'],
                    required_skill,
                    match_score,
                    decision,
                    'manual',
                    datetime.now() - timedelta(days=random.randint(1, 90))
                )
            )
            applications_created += 1
    
    conn.commit()
    cursor.close()
    conn.close()
    
    print(f"✅ Created {applications_created} application records")

def update_user_metrics():
    """Update user rating and engagement scores based on new data"""
    print("🔄 Updating user metrics...")
    
    users = get_all_users()
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    for user in users:
        # Calculate new rating based on completed ratings
        cursor.execute(
            """
            SELECT AVG(score) FROM user_ratings 
            WHERE ratee_id = %s AND status = 'completed'
            """,
            (user['user_id'],)
        )
        rating_result = cursor.fetchone()
        new_rating = round(float(rating_result[0]) if rating_result[0] else 3.5, 1)
        
        # Calculate engagement score from last 30 days
        cursor.execute(
            """
            SELECT SUM(points) FROM engagement 
            WHERE user_id = %s AND timestamp >= CURRENT_DATE - INTERVAL '30 days'
            """,
            (user['user_id'],)
        )
        engagement_result = cursor.fetchone()
        new_engagement = engagement_result[0] if engagement_result[0] else 50
        
        # Update user
        cursor.execute(
            """
            UPDATE users 
            SET rating = %s, engagement_score = %s
            WHERE user_id = %s
            """,
            (new_rating, new_engagement, user['user_id'])
        )
    
    conn.commit()
    cursor.close()
    conn.close()
    
    print("✅ Updated user metrics")

def main():
    """Main function to populate all demo data"""
    print("🚀 Starting Konverge Demo Data Population")
    print("=" * 50)
    
    try:
        # Step 1: Create project collaborations
        create_project_collaborations()
        
        # Step 2: Create engagement history
        create_engagement_history()
        
        # Step 3: Create rating progress
        create_rating_progress()
        
        # Step 4: Create application statistics
        create_application_statistics()
        
        # Step 5: Update user metrics
        update_user_metrics()
        
        print("=" * 50)
        print("🎉 Demo data population completed successfully!")
        print("📊 Your dashboard now has rich analytics data to showcase!")
        
    except Exception as e:
        print(f"❌ Error populating demo data: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()
