# BuildFlow 🚀

> AI-powered website builder with GitHub integration and local-first data storage

## 📸 Screenshots

### English Interface
<img src="./screen-en.png" alt="BuildFlow English Interface" width="800"/>

### 中文界面
<img src="./screen-zh.png" alt="BuildFlow 中文界面" width="800"/>

## ✨ Features

- **AI Website Generation** - Create websites using natural language with multiple AI providers (OpenAI, Google Gemini, DeepSeek)
- **Local-First Storage** - All your data stored securely in your browser using IndexedDB
- **GitHub Integration** - Seamlessly sync projects to GitHub repositories
- **One-Click Deployment** - Deploy to GitHub Pages or Vercel with a single click
- **Monaco Editor** - Professional code editing experience powered by VS Code's editor
- **Secure API Keys** - Client-side encryption for your AI provider API keys
- **Multi-File Support** - Create complex websites with HTML, CSS, and JavaScript files
- **Real-Time Preview** - See your changes instantly in the preview pane

## 🛠 Technology Stack

### Frontend
- **Next.js 15** - React framework with App Router
- **React 19** - Latest React with improved performance
- **TypeScript** - Type-safe development
- **Tailwind CSS 4** - Modern utility-first CSS
- **Monaco Editor** - VS Code editor component
- **Radix UI** - Accessible UI components
- **Framer Motion** - Smooth animations

### Data & Storage
- **IndexedDB** (via idb) - Local-first data storage
- **Client-side Encryption** (crypto-js) - Secure API key storage

### Integrations
- **GitHub API** (@octokit/rest) - Repository and deployment management
- **OpenAI** - GPT-4 and GPT-3.5 integration
- **Google Generative AI** - Gemini models
- **DeepSeek** - Advanced coding models

### State Management
- **TanStack Query** - Server state management
- **React Context** - Global state management

## 🚀 Getting Started

### Prerequisites

- Node.js 20 or higher
- npm or yarn
- GitHub account
- AI provider API key (OpenAI, Google Gemini, or DeepSeek)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/buildflow.git
cd buildflow
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env.local` file:
```bash
cp .env.example .env.local
```

4. Configure your environment variables:
```env
# GitHub OAuth (create at https://github.com/settings/developers)
NEXT_PUBLIC_GITHUB_CLIENT_ID=your_client_id
GITHUB_CLIENT_SECRET=your_client_secret
NEXT_PUBLIC_GITHUB_REDIRECT_URI=http://localhost:3000/auth/callback
```

5. Start the development server:
```bash
npm run dev
```

6. Open [http://localhost:3000](http://localhost:3000) in your browser

## 📖 Usage

### 1. Sign in with GitHub

Click "Sign in with GitHub" to authenticate and enable repository integration.

### 2. Configure AI Provider

Go to Settings → API Keys and add your preferred AI provider API key:
- OpenAI: Get from [platform.openai.com](https://platform.openai.com)
- Google Gemini: Get from [ai.google.dev](https://ai.google.dev)
- DeepSeek: Get from [platform.deepseek.com](https://platform.deepseek.com)

### 3. Create a Project

1. Click "New Project"
2. Describe your website idea in natural language
3. Watch as AI generates your website code
4. Edit the code in the Monaco editor
5. Preview changes in real-time

### 4. Deploy Your Website

Choose your deployment platform:
- **GitHub Pages**: Free static hosting (recommended)
- **Vercel**: Advanced features with global CDN

Click "Deploy" and your website will be live in seconds!

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     BuildFlow Web App                        │
│                   (Next.js 15 + React 19)                    │
└─────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
        ▼                     ▼                     ▼
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│   Browser    │    │   GitHub     │    │  AI Provider │
│  IndexedDB   │    │     API      │    │   (Direct)   │
└──────────────┘    └──────────────┘    └──────────────┘
│                   │                    │
├─ projects        ├─ repos             ├─ OpenAI
├─ apiKeys (enc)   ├─ pages deploy      ├─ Gemini
└─ settings        ├─ contents          └─ DeepSeek
                   └─ commits
```

## 🔒 Security

### API Key Storage

Your AI provider API keys are:
- ✅ Encrypted using AES-256 encryption
- ✅ Stored locally in IndexedDB (never sent to our servers)
- ✅ Encrypted with your GitHub token as the key
- ✅ Automatically cleared when you log out

### Data Privacy

- All project data is stored locally in your browser
- Optional sync to your GitHub repositories (you control)
- No server-side data storage
- No tracking or analytics

## 📦 Project Structure

```
buildflow/
├── app/                      # Next.js app directory
│   ├── api/                  # API routes
│   │   └── github/           # GitHub API endpoints
│   ├── auth/                 # Authentication pages
│   └── (public)/             # Public pages
├── components/               # React components
│   ├── editor/               # Code editor components
│   ├── settings/             # Settings panels
│   └── ui/                   # UI components (shadcn/ui)
├── hooks/                    # Custom React hooks
├── lib/                      # Core libraries
│   ├── indexeddb/            # IndexedDB data layer
│   ├── github/               # GitHub integration
│   ├── ai-providers/         # AI provider implementations
│   ├── crypto/               # Encryption utilities
│   └── deploy/               # Deployment logic
├── types/                    # TypeScript type definitions
└── public/                   # Static assets
```

## 🛣️ Roadmap

- [x] GitHub OAuth authentication
- [x] IndexedDB local storage
- [x] OpenAI integration
- [x] Google Gemini integration
- [x] DeepSeek integration
- [x] GitHub repository creation
- [x] GitHub Pages deployment
- [ ] Vercel deployment integration
- [ ] Tauri desktop app (native encryption)
- [ ] Project templates library
- [ ] Collaborative editing
- [ ] AI code review
- [ ] Performance analytics

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

MIT License - see LICENSE file for details

## 🙏 Acknowledgments

- Built with [Next.js](https://nextjs.org/)
- UI components from [shadcn/ui](https://ui.shadcn.com/)
- Editor powered by [Monaco Editor](https://microsoft.github.io/monaco-editor/)
- Icons from [Lucide](https://lucide.dev/)

---

Made with ❤️ by the BuildFlow team
