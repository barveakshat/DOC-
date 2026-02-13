"""
DOC+ Medical Assistant - Architecture Diagram Generator

This script generates a visual architecture diagram of the application
using the diagrams library. It shows the complete system architecture
including frontend, backend, authentication, and external services.

Installation:
    pip install diagrams

Usage:
    python generate_architecture_diagram.py
"""

from diagrams import Diagram, Cluster, Edge
from diagrams.onprem.client import Client
from diagrams.programming.framework import React
from diagrams.programming.language import TypeScript
from diagrams.saas.chat import Slack
from diagrams.saas.identity import Auth0
from diagrams.onprem.database import PostgreSQL
from diagrams.onprem.compute import Server
from diagrams.saas.analytics import Snowflake
from diagrams.custom import Custom
from diagrams.generic.blank import Blank
from diagrams.generic.database import SQL
from diagrams.generic.device import Mobile
from diagrams.generic.network import Firewall
from diagrams.generic.storage import Storage
import os


def generate_diagram():
    """Generate the architecture diagram for DOC+ Medical Assistant"""
    
    # Custom attributes for styling
    graph_attr = {
        "fontsize": "16",
        "bgcolor": "white",
        "pad": "0.5"
    }
    
    with Diagram(
        "DOC+ Medical Assistant Architecture",
        filename="doc_plus_architecture",
        show=False,
        direction="TB",
        graph_attr=graph_attr,
        outformat="png"
    ):
        
        # Users
        with Cluster("Users"):
            doctor = Client("Doctor")
            patient = Client("Patient")
        
        # Frontend Layer
        with Cluster("Frontend Layer"):
            with Cluster("React Application"):
                # Core pages
                pages = React("Pages\n(Dashboard, Chat, Profile)")
                
                # Components
                components = React("Components\n(ChatWindow, Sidebar,\nOnboarding)")
                
                # State Management
                contexts = TypeScript("Contexts\n(AuthContext)")
                
                # Hooks
                hooks = TypeScript("Custom Hooks\n(useChatSessions,\nuseDoctorPatientChat)")
                
                pages >> components
                components >> contexts
                components >> hooks
        
        # Authentication Layer
        with Cluster("Authentication & Identity"):
            clerk = Auth0("Clerk\n(User Auth & Management)")
        
        # Backend Services Layer
        with Cluster("Backend Services (Supabase)"):
            # Database
            with Cluster("Database"):
                postgres = PostgreSQL("PostgreSQL\n(Patient, Doctor,\nChat Data)")
                rls = Firewall("Row Level Security\n(RLS Policies)")
                postgres - rls
            
            # Supabase Services
            supabase_api = Server("Supabase API\n(REST & Realtime)")
            edge_functions = Server("Edge Functions\n(Serverless Logic)")
            storage = Storage("Supabase Storage\n(File Uploads)")
            
            supabase_api >> postgres
            edge_functions >> postgres
        
        # External Services
        with Cluster("External Services"):
            openrouter = Server("OpenRouter API\n(GPT-OSS-20B)\nAI Models")
            resend = Server("Resend\n(Email Service)")
        
        # Integration Layer
        with Cluster("Integration Layer"):
            supabase_client = SQL("Supabase Client\n(Database Access)")
            openrouter_service = TypeScript("OpenRouter Service\n(AI Integration)")
        
        # User interactions
        doctor >> Edge(label="Access") >> pages
        patient >> Edge(label="Access") >> pages
        
        # Frontend to Auth
        pages >> Edge(label="Authentication") >> clerk
        
        # Frontend to Integration Layer
        hooks >> Edge(label="Query/Mutation") >> supabase_client
        components >> Edge(label="AI Requests") >> openrouter_service
        
        # Integration to Backend
        supabase_client >> Edge(label="API Calls") >> supabase_api
        openrouter_service >> Edge(label="AI Inference") >> openrouter
        
        # Backend Services
        supabase_api >> Edge(label="Real-time\nSubscriptions") >> components
        edge_functions >> Edge(label="Notifications") >> resend
        storage >> Edge(label="File Access") >> components
        
        # Auth to Database
        clerk >> Edge(label="User Info") >> postgres


def generate_detailed_component_diagram():
    """Generate a detailed component-level diagram"""
    
    graph_attr = {
        "fontsize": "16",
        "bgcolor": "white",
        "pad": "0.5"
    }
    
    with Diagram(
        "DOC+ Component Architecture",
        filename="doc_plus_components",
        show=False,
        direction="LR",
        graph_attr=graph_attr,
        outformat="png"
    ):
        
        # Frontend Components Detail
        with Cluster("Frontend Components"):
            # Doctor Components
            with Cluster("Doctor Module"):
                doctor_dashboard = React("DoctorDashboard")
                doctor_chat = React("DoctorChat")
                doctor_profile = React("DoctorProfile")
                doctor_onboarding = React("DoctorOnboarding")
                doctor_sidebar = React("DoctorSidebar")
                
                doctor_dashboard >> doctor_chat
                doctor_dashboard >> doctor_profile
            
            # Patient Components
            with Cluster("Patient Module"):
                patient_registration = React("PatientRegistration")
                patient_profile = React("PatientProfile")
                ai_chat = React("AIChat\n(Therapeutic)")
                patient_chat = React("PatientDoctorChat")
                patient_sidebar = React("PatientSidebar")
                
                patient_registration >> patient_profile
                patient_profile >> [ai_chat, patient_chat]
            
            # Shared Components
            with Cluster("Shared Components"):
                chat_interface = React("ChatInterface")
                chat_window = React("ChatWindow")
                conversation_list = React("ConversationList")
                login = React("LoginPage")
                role_selection = React("RoleSelection")
                
                chat_interface >> chat_window
                chat_interface >> conversation_list
        
        # Services Layer
        with Cluster("Services Layer"):
            openrouter_svc = TypeScript("openRouterService\n(AI Integration)")
        
        # Hooks Layer
        with Cluster("Custom Hooks"):
            chat_sessions_hook = TypeScript("useChatSessions")
            doctor_patient_chat_hook = TypeScript("useDoctorPatientChat")
        
        # Database Tables
        with Cluster("Database Schema"):
            doctors_table = SQL("doctors")
            patients_table = SQL("patients")
            chat_sessions_table = SQL("chat_sessions")
            chat_messages = SQL("chat_messages")
            
            doctors_table >> chat_sessions_table
            patients_table >> chat_sessions_table
            chat_sessions_table >> chat_messages
        
        # Connections
        doctor_chat >> chat_interface
        patient_chat >> chat_interface
        ai_chat >> openrouter_svc
        patient_chat >> openrouter_svc
        
        chat_interface >> chat_sessions_hook
        chat_interface >> doctor_patient_chat_hook
        chat_sessions_hook >> doctors_table
        chat_sessions_hook >> patients_table
        chat_sessions_hook >> chat_sessions_table
        doctor_patient_chat_hook >> doctors_table
        doctor_patient_chat_hook >> patients_table
        doctor_patient_chat_hook >> chat_sessions_table


def generate_data_flow_diagram():
    """Generate a data flow diagram"""
    
    graph_attr = {
        "fontsize": "16",
        "bgcolor": "white",
        "pad": "0.5"
    }
    
    with Diagram(
        "DOC+ Data Flow",
        filename="doc_plus_dataflow",
        show=False,
        direction="TB",
        graph_attr=graph_attr,
        outformat="png"
    ):
        
        # Users
        doctor_user = Client("Doctor")
        patient_user = Client("Patient")
        
        # Frontend
        with Cluster("Frontend"):
            ui = React("React UI")
            query_client = TypeScript("React Query\n(State Management)")
        
        # API Layer
        with Cluster("API & Integration"):
            supabase_js = SQL("@supabase/supabase-js")
            clerk_react = Auth0("@clerk/clerk-react")
            openrouter = Server("OpenRouter API")
        
        # Backend
        with Cluster("Supabase Backend"):
            realtime = Server("Realtime Server\n(WebSocket)")
            rest_api = Server("REST API")
            auth = Firewall("Auth & RLS")
            db = PostgreSQL("PostgreSQL")
            
            rest_api >> auth >> db
            realtime >> auth >> db
        
        # Data Flow
        doctor_user >> Edge(label="Interact") >> ui
        patient_user >> Edge(label="Interact") >> ui
        
        ui >> Edge(label="State") >> query_client
        
        query_client >> Edge(label="Queries") >> supabase_js
        query_client >> Edge(label="Auth") >> clerk_react
        
        ui >> Edge(label="AI Chat") >> openrouter
        
        supabase_js >> Edge(label="CRUD") >> rest_api
        supabase_js >> Edge(label="Subscribe") >> realtime
        
        realtime >> Edge(label="Push Updates", style="dashed") >> query_client
        
        clerk_react >> Edge(label="User Session") >> auth


def print_project_structure():
    """Print a text-based project structure overview"""
    
    structure = """
    ╔═══════════════════════════════════════════════════════════════╗
    ║           DOC+ Medical Assistant Architecture                 ║
    ╚═══════════════════════════════════════════════════════════════╝
    
    📁 Project Structure:
    
    ├── 🎨 Frontend (React + TypeScript + Vite)
    │   ├── Pages/
    │   │   ├── DoctorDashboard - Doctor main interface
    │   │   ├── DoctorChat - Doctor-patient messaging
    │   │   ├── AIChat - AI therapeutic chat for patients
    │   │   ├── PatientRegistration - New patient onboarding
    │   │   └── SignIn/SignUp - Authentication pages
    │   │
    │   ├── Components/
    │   │   ├── ChatInterface - Main chat UI component
    │   │   ├── ChatWindow - Message display and input
    │   │   ├── DoctorOnboarding - Doctor registration flow
    │   │   ├── DoctorProfile - Doctor information management
    │   │   └── PatientProfile - Patient information display
    │   │
    │   ├── Contexts/
    │   │   └── AuthContext - Global authentication state
    │   │
    │   ├── Hooks/
    │   │   ├── useChatSessions - Chat session management
    │   │   └── useDoctorPatientChat - Doctor-patient chat logic
    │   │
    │   ├── Services/
    │   │   └── openRouterService - AI integration service
    │   │
    │   └── Integrations/
    │       └── supabase/ - Supabase client configuration
    │
    ├── 🔐 Authentication (Clerk)
    │   ├── User Management
    │   ├── Session Handling
    │   └── Role-based Access Control (Doctor/Patient)
    │
    ├── 🗄️ Backend (Supabase)
    │   ├── PostgreSQL Database
    │   │   ├── doctors - Doctor profiles and credentials
    │   │   ├── patients - Patient records and medical history
    │   │   ├── chat_sessions - Conversation sessions
    │   │   └── chat_messages - Individual messages
    │   │
    │   ├── Row Level Security (RLS)
    │   │   ├── Doctor policies - Access to assigned patients
    │   │   └── Patient policies - Access to own data
    │   │
    │   ├── Edge Functions
    │   │   └── Serverless backend logic
    │   │
    │   └── Storage
    │       └── Medical file uploads
    │
    └── 🔌 External Services
        ├── OpenRouter API - AI/ML models (GPT-OSS-20B)
        └── Resend - Email delivery service
    
    ═══════════════════════════════════════════════════════════════
    
    🔄 Key Data Flows:
    
    1. Doctor Registration:
       Doctor → Clerk Auth → Supabase → doctors table
    
    2. Patient Registration:
       Doctor → Patient Invitation → Email → Patient Signup
       → Clerk Auth → Supabase → patients table
    
    3. Chat Communication:
       User → ChatInterface → useChatSessions Hook
       → Supabase Realtime → chat_sessions/chat_messages
    
    4. AI Therapeutic Chat:
       Patient → AIChat → openRouterService
       → OpenRouter API → GPT-OSS-20B → Response
    
    5. File Upload:
       User → Component → Supabase Storage → File URL
       → Database Reference
    
    ═══════════════════════════════════════════════════════════════
    
    📊 Technology Stack:
    
    Frontend:
    - React 18 + TypeScript
    - Vite (Build Tool)
    - Tailwind CSS + shadcn/ui
    - React Query (@tanstack/react-query)
    - React Router
    
    Authentication:
    - Clerk (@clerk/clerk-react)
    
    Backend:
    - Supabase (@supabase/supabase-js)
    - PostgreSQL (via Supabase)
    - Supabase Edge Functions
    
    AI/ML:
    - OpenRouter API
    - GPT-OSS-20B Model
    
    Other Services:
    - Resend (Email)
    
    ═══════════════════════════════════════════════════════════════
    """
    
    print(structure)
    
    # Also save to file
    with open('architecture_overview.txt', 'w', encoding='utf-8') as f:
        f.write(structure)
    print("\n✅ Architecture overview saved to 'architecture_overview.txt'")


if __name__ == "__main__":
    print("🏗️  Generating DOC+ Medical Assistant Architecture Diagrams...\n")
    
    try:
        # Generate all diagrams
        print("📊 Generating main architecture diagram...")
        generate_diagram()
        print("✅ Main architecture diagram created: doc_plus_architecture.png")
        
        print("\n📊 Generating component diagram...")
        generate_detailed_component_diagram()
        print("✅ Component diagram created: doc_plus_components.png")
        
        print("\n📊 Generating data flow diagram...")
        generate_data_flow_diagram()
        print("✅ Data flow diagram created: doc_plus_dataflow.png")
        
        print("\n📊 Generating text overview...")
        print_project_structure()
        
        print("\n" + "="*70)
        print("🎉 All diagrams generated successfully!")
        print("="*70)
        print("\nGenerated files:")
        print("  1. doc_plus_architecture.png - High-level system architecture")
        print("  2. doc_plus_components.png - Detailed component structure")
        print("  3. doc_plus_dataflow.png - Data flow visualization")
        print("  4. architecture_overview.txt - Text-based structure overview")
        print("\n💡 Tip: If diagrams library is not installed, run:")
        print("   pip install diagrams")
        
    except ImportError as e:
        print(f"\n❌ Error: {e}")
        print("\n📦 Please install the required package:")
        print("   pip install diagrams")
        print("\nNote: 'diagrams' library requires Graphviz to be installed:")
        print("   - Windows: choco install graphviz")
        print("   - Or download from: https://graphviz.org/download/")
        
    except Exception as e:
        print(f"\n❌ An error occurred: {e}")
        print("\nPlease ensure Graphviz is installed and added to your PATH.")
