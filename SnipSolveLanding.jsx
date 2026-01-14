import React, { useState } from 'react';
import { 
  FileText, 
  MessageSquare, 
  History, 
  Settings, 
  Plus,
  Upload,
  Sparkles,
  Command,
  ArrowRight
} from 'lucide-react';

const SnipSolveLanding = () => {
  const [hasKnowledgeBase, setHasKnowledgeBase] = useState(false);

  return (
    <div className="flex h-screen bg-[#0b0b0b] text-gray-100">
      {/* Sidebar */}
      <aside className="w-16 bg-[#0f0f0f] border-r border-gray-800 flex flex-col items-center py-6 space-y-6">
        {/* Logo */}
        <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center mb-8">
          <Sparkles className="w-6 h-6 text-white" />
        </div>

        {/* Navigation Icons */}
        <nav className="flex-1 flex flex-col space-y-4">
          <button className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-gray-800 transition-colors text-gray-400 hover:text-white">
            <History className="w-5 h-5" />
          </button>
          <button className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-gray-800 transition-colors text-gray-400 hover:text-white">
            <FileText className="w-5 h-5" />
          </button>
          <button className="w-10 h-10 flex items-center justify-center rounded-lg bg-indigo-600 text-white">
            <MessageSquare className="w-5 h-5" />
          </button>
        </nav>

        {/* Settings at bottom */}
        <button className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-gray-800 transition-colors text-gray-400 hover:text-white">
          <Settings className="w-5 h-5" />
        </button>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center justify-center px-8 overflow-y-auto">
        {/* Hero Section */}
        <div className="text-center mb-12 max-w-3xl">
          <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
            SnipSolve
          </h1>
          <p className="text-xl text-gray-400">
            Your documentation, instantly accessible.
          </p>
          <p className="text-sm text-gray-500 mt-2">
            Capture any screen region to instantly search your docs.
          </p>
        </div>

        {/* Knowledge Base Empty State */}
        {!hasKnowledgeBase && (
          <div className="mb-8 w-full max-w-2xl">
            <div className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20 rounded-xl p-6 flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-amber-500/20 rounded-lg flex items-center justify-center">
                  <Upload className="w-6 h-6 text-amber-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-white mb-1">Knowledge Base Empty</h3>
                  <p className="text-sm text-gray-400">
                    Upload your PDFs or SOPs to enable AI context.
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setHasKnowledgeBase(true)}
                className="px-6 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-medium rounded-lg transition-all duration-200 flex items-center space-x-2 shadow-lg shadow-amber-500/20"
              >
                <Plus className="w-4 h-4" />
                <span>Add Knowledge Base</span>
              </button>
            </div>
          </div>
        )}

        {/* Action Cards Container */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-4xl">
          {/* Primary Action: Snip & Solve */}
          <div className="md:col-span-2">
            <div className="group relative bg-gradient-to-br from-indigo-600 to-purple-700 rounded-2xl p-10 overflow-hidden cursor-pointer transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl hover:shadow-indigo-500/30">
              {/* Animated background effect */}
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/0 to-purple-600/0 group-hover:from-indigo-500/20 group-hover:to-purple-600/20 transition-all duration-500" />
              
              {/* Content */}
              <div className="relative z-10 text-center">
                {/* Icon */}
                <div className="w-16 h-16 mx-auto mb-6 bg-white/10 rounded-2xl flex items-center justify-center backdrop-blur-sm border border-white/20 group-hover:scale-110 transition-transform duration-300">
                  <Command className="w-8 h-8 text-white" />
                </div>

                {/* Title */}
                <h2 className="text-3xl font-bold text-white mb-3">
                  Snip & Solve
                </h2>

                {/* Description */}
                <p className="text-indigo-100 mb-6 text-lg">
                  Capture any screen region to instantly search your docs.
                </p>

                {/* Keyboard Shortcut Display */}
                <div className="flex items-center justify-center space-x-2 mb-4">
                  <span className="text-sm text-indigo-200 uppercase tracking-wider">Press</span>
                  <div className="flex items-center space-x-1">
                    <kbd className="px-3 py-2 bg-white/20 backdrop-blur-md border border-white/30 rounded-lg text-white font-mono text-sm shadow-lg">
                      Alt
                    </kbd>
                    <span className="text-white font-bold">+</span>
                    <kbd className="px-3 py-2 bg-white/20 backdrop-blur-md border border-white/30 rounded-lg text-white font-mono text-sm shadow-lg">
                      S
                    </kbd>
                  </div>
                </div>

                {/* Hover indicator */}
                <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <ArrowRight className="w-6 h-6 mx-auto text-white animate-pulse" />
                </div>
              </div>

              {/* Decorative elements */}
              <div className="absolute -top-20 -right-20 w-40 h-40 bg-white/5 rounded-full blur-3xl" />
              <div className="absolute -bottom-20 -left-20 w-40 h-40 bg-purple-500/10 rounded-full blur-3xl" />
            </div>
          </div>

          {/* Secondary Action: AI Chat Assistant */}
          <div className="md:col-span-2">
            <div className="group relative bg-[#1a1a1a] border border-gray-800 rounded-xl p-8 cursor-pointer transition-all duration-300 hover:border-indigo-500/50 hover:shadow-lg hover:shadow-indigo-500/10">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center">
                    <MessageSquare className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-white mb-1">
                      Ask AI Assistant
                    </h3>
                    <p className="text-sm text-gray-400">
                      Chat without capturing your screen
                    </p>
                  </div>
                </div>
                <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                  <ArrowRight className="w-5 h-5 text-indigo-400" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer hint */}
        <div className="mt-12 text-center text-sm text-gray-600">
          <p>Start by uploading your documentation or press <kbd className="px-2 py-1 bg-gray-800 rounded text-gray-400 font-mono">Alt + S</kbd> to begin</p>
        </div>
      </main>
    </div>
  );
};

export default SnipSolveLanding;
