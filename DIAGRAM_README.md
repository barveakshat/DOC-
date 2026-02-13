# Architecture Diagram Generator

This directory contains a Python script to generate visual architecture diagrams for the DOC+ Medical Assistant application.

## Prerequisites

### 1. Python
Make sure you have Python 3.7+ installed:
```bash
python --version
```

### 2. Graphviz
The `diagrams` library requires Graphviz to be installed on your system.

**Windows Installation:**
```bash
# Using Chocolatey
choco install graphviz

# Or download the installer from:
# https://graphviz.org/download/
```

**After installation, make sure Graphviz is added to your PATH environment variable.**

**Other platforms:**
- macOS: `brew install graphviz`
- Linux: `sudo apt-get install graphviz` (Ubuntu/Debian) or `sudo yum install graphviz` (RHEL/CentOS)

## Installation

1. Install the required Python packages:
```bash
pip install -r diagram_requirements.txt
```

Or install directly:
```bash
pip install diagrams
```

## Usage

Run the script to generate all architecture diagrams:
```bash
python generate_architecture_diagram.py
```

## Generated Outputs

The script will create the following files:

### 1. `doc_plus_architecture.png`
High-level system architecture showing:
- User roles (Doctor, Patient)
- Frontend layer (React components, contexts, hooks)
- Authentication layer (Clerk)
- Backend services (Supabase)
- External services (OpenRouter AI, Resend)
- Data flow between layers

### 2. `doc_plus_components.png`
Detailed component-level diagram showing:
- Doctor module components (Dashboard, Chat, Profile, etc.)
- Patient module components (Registration, Profile, AI Chat, etc.)
- Shared components (ChatInterface, LoginPage, etc.)
- Services and hooks
- Database schema relationships

### 3. `doc_plus_dataflow.png`
Data flow visualization showing:
- User interactions
- State management (React Query)
- API calls and integrations
- Real-time data synchronization
- Authentication flow

### 4. `architecture_overview.txt`
Text-based architecture overview with:
- Complete project structure
- Key data flows
- Technology stack details

## Diagram Features

- **Clean Visual Design**: Professional-looking diagrams with proper clustering
- **Comprehensive Coverage**: Shows all major components and their relationships
- **Multiple Perspectives**: System, component, and data flow views
- **Auto-generated**: Reflects the actual project structure

## Customization

To modify the diagrams, edit `generate_architecture_diagram.py`:

- **Add new components**: Add new nodes in the appropriate cluster
- **Modify relationships**: Change the Edge connections between components
- **Update styling**: Modify the `graph_attr` dictionary
- **Change layout**: Adjust the `direction` parameter ("TB", "LR", "BT", "RL")

## Troubleshooting

### Error: "Graphviz executable not found"
- Ensure Graphviz is installed and added to your system PATH
- Restart your terminal/command prompt after installation
- Verify installation: `dot -V`

### Error: "ImportError: No module named diagrams"
- Install the diagrams package: `pip install diagrams`

### Diagrams not rendering properly
- Try updating the diagrams package: `pip install --upgrade diagrams`
- Check that all cluster names are unique
- Verify Graphviz version: `dot -V` (should be 2.40+)

## Architecture Overview

### Application Type
**DOC+ Medical Assistant** - A comprehensive healthcare communication platform connecting doctors and patients through secure, AI-powered conversations.

### Key Technologies
- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui
- **Authentication**: Clerk
- **Backend**: Supabase (PostgreSQL, Edge Functions, Storage)
- **AI Integration**: OpenRouter API (GPT-OSS-20B model)
- **Email**: Resend

### Core Features
1. **Doctor Dashboard**: Patient management and secure chat
2. **Patient Portal**: AI therapeutic chat and doctor communication
3. **Real-time Chat**: WebSocket-based messaging
4. **File Uploads**: Medical document sharing
5. **AI-Powered Insights**: Treatment recommendations and therapeutic support

## License

This diagram generator is part of the DOC+ Medical Assistant project.

## Support

For issues or questions about generating diagrams, please refer to:
- Diagrams library documentation: https://diagrams.mingrammer.com/
- Graphviz documentation: https://graphviz.org/documentation/
