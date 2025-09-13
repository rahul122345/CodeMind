import { JournalInput } from './components/JournalInput.js';
import { CodeEditor } from './components/CodeEditor.js';
import { ReflectionOutput } from './components/ReflectionOutput.js';
import { FileUploader } from './components/FileUploader.js';
import { ExportManager } from './components/ExportManager.js';
import { ToastManager } from './components/ToastManager.js';
import { ModalManager } from './components/ModalManager.js';

import { StorageManager } from './backend/utils/storage.js';

/**
 * DEV-MIND™ Main Application Class
 * Orchestrates all components and manages application state
 */
class DevMindApp {
  constructor() {
    this.components = {};
    this.state = {
      journalContent: '',
      codeContent: '',
      selectedLanguage: 'javascript',
      reflectionHistory: [],
      isLoading: false
    };
    
    this.init();
  }

  /**
   * Initialize the application
   */
  async init() {
    try {
      // Initialize managers
      this.toast = new ToastManager();
      this.modal = new ModalManager();
      this.storage = new StorageManager();
      
      
      // Initialize components
      this.initializeComponents();
      
      // Set up event listeners
      this.setupEventListeners();
      
      // Load saved state
      await this.loadSavedState();
      
      // Show welcome message
      this.showWelcomeMessage();
      
      console.log('🧠 DEV-MIND™ initialized successfully');
    } catch (error) {
      console.error('Failed to initialize DEV-MIND™:', error);
      this.toast.error('Failed to initialize application');
    }
  }

  /**
   * Initialize all components
   */
  initializeComponents() {
    // Initialize Journal Input
    this.components.journal = new JournalInput('journal-input', (content) => {
      this.state.journalContent = content;
      this.autoSave();
    });

    // Initialize Code Editor
    this.components.codeEditor = new CodeEditor('code-editor', {
      onContentChange: (content) => {
        this.state.codeContent = content;
        this.autoSave();
      },
      onLanguageChange: (language) => {
        this.state.selectedLanguage = language;
        this.updateLanguageSelector();
      }
    });

    // Initialize Reflection Output
    this.components.reflection = new ReflectionOutput('reflection-output');

    // Initialize File Uploader
    this.components.fileUploader = new FileUploader('file-input', {
      onFileLoad: (content, language) => {
        this.components.codeEditor.setContent(content);
        this.components.codeEditor.setLanguage(language);
        this.state.selectedLanguage = language;
        this.updateLanguageSelector();
        this.toast.success('File loaded successfully');
      },
      onError: (error) => {
        this.toast.error(`File upload failed: ${error}`);
      }
    });

    // Initialize Export Manager
    this.components.export = new ExportManager();
  }

  /**
   * Set up event listeners
   */
  setupEventListeners() {
    // Reflect button
    document.getElementById('reflect-btn').addEventListener('click', () => {
      this.generateReflection();
    });

    // Clear journal button
    document.getElementById('clear-journal').addEventListener('click', () => {
      this.clearJournal();
    });

    // Language selector
    document.getElementById('language-select').addEventListener('change', (e) => {
      this.changeLanguage(e.target.value);
    });

    // Upload button
    document.getElementById('upload-btn').addEventListener('click', () => {
      document.getElementById('file-input').click();
    });

    // Export buttons
    document.getElementById('copy-output').addEventListener('click', () => {
      this.copyToClipboard();
    });

    document.getElementById('export-json').addEventListener('click', () => {
      this.exportAsJSON();
    });

    document.getElementById('export-md').addEventListener('click', () => {
      this.exportAsMarkdown();
    });

    // Floating action buttons
    document.getElementById('fab-clear').addEventListener('click', () => {
      this.clearAll();
    });

    document.getElementById('fab-save').addEventListener('click', () => {
      this.saveSession();
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
          case 'Enter':
            e.preventDefault();
            this.generateReflection();
            break;
          case 's':
            e.preventDefault();
            this.saveSession();
            break;
          case 'l':
            e.preventDefault();
            document.getElementById('file-input').click();
            break;
        }
      }
    });
  }

  /**
   * Generate AI reflection
   */
  async generateReflection() {
    if (!this.state.journalContent.trim()) {
      this.toast.warning('Please enter your thoughts in the journal first');
      return;
    }

    this.setLoading(true);
    
    try {
      const response = await fetch('http://localhost:5001/api/reflect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          journalContent: this.state.journalContent,
          codeContent: this.state.codeContent,
          language: this.state.selectedLanguage
        })
      });
      const data = await response.json();
      if (!response.ok || !data.reflection) {
        throw new Error(data.error || 'AI Reflection failed');
      }
      const reflection = data.reflection;

      // Add to history
      this.state.reflectionHistory.push({
        timestamp: new Date().toISOString(),
        journal: this.state.journalContent,
        code: this.state.codeContent,
        language: this.state.selectedLanguage,
        reflection: reflection
      });

      // Display reflection with typing animation
      await this.components.reflection.displayReflection(reflection);
      
      this.toast.success('Reflection generated successfully');
      this.autoSave();
      
    } catch (error) {
      console.error('Reflection generation failed:', error);
      this.toast.error('Failed to generate reflection. Please check your API key.');
      
      // Show fallback message
      this.components.reflection.showFallbackMessage(error.message);
    } finally {
      this.setLoading(false);
    }
  }

  /**
   * Clear journal content
   */
  clearJournal() {
    this.modal.confirm(
      'Clear Journal',
      'Are you sure you want to clear the journal content?',
      () => {
        this.components.journal.clear();
        this.state.journalContent = '';
        this.autoSave();
        this.toast.info('Journal cleared');
      }
    );
  }

  /**
   * Clear all content
   */
  clearAll() {
    this.modal.confirm(
      'Clear All',
      'Are you sure you want to clear all content? This cannot be undone.',
      () => {
        this.components.journal.clear();
        this.components.codeEditor.clear();
        this.components.reflection.clear();
        this.state.journalContent = '';
        this.state.codeContent = '';
        this.state.reflectionHistory = [];
        this.autoSave();
        this.toast.info('All content cleared');
      }
    );
  }

  /**
   * Change programming language
   */
  changeLanguage(language) {
    this.state.selectedLanguage = language;
    this.components.codeEditor.setLanguage(language);
    this.toast.info(`Language changed to ${language}`);
  }

  /**
   * Update language selector UI
   */
  updateLanguageSelector() {
    const selector = document.getElementById('language-select');
    selector.value = this.state.selectedLanguage;
  }

  /**
   * Copy reflection to clipboard
   */
  async copyToClipboard() {
    try {
      const content = this.components.reflection.getContent();
      if (!content) {
        this.toast.warning('No reflection to copy');
        return;
      }

      await navigator.clipboard.writeText(content);
      this.toast.success('Reflection copied to clipboard');
    } catch (error) {
      this.toast.error('Failed to copy to clipboard');
    }
  }

  /**
   * Export as JSON
   */
  exportAsJSON() {
    const data = {
      timestamp: new Date().toISOString(),
      journal: this.state.journalContent,
      code: this.state.codeContent,
      language: this.state.selectedLanguage,
      reflection: this.components.reflection.getContent(),
      history: this.state.reflectionHistory
    };

    this.components.export.exportAsJSON(data, 'dev-mind-session.json');
    this.toast.success('Session exported as JSON');
  }

  /**
   * Export as Markdown
   */
  exportAsMarkdown() {
    const data = {
      journal: this.state.journalContent,
      code: this.state.codeContent,
      language: this.state.selectedLanguage,
      reflection: this.components.reflection.getContent()
    };

    this.components.export.exportAsMarkdown(data, 'dev-mind-session.md');
    this.toast.success('Session exported as Markdown');
  }

  /**
   * Save current session
   */
  async saveSession() {
    try {
      await this.storage.save('devmind_session', {
        journalContent: this.state.journalContent,
        codeContent: this.state.codeContent,
        selectedLanguage: this.state.selectedLanguage,
        reflectionHistory: this.state.reflectionHistory,
        timestamp: new Date().toISOString()
      });

      this.toast.success('Session saved successfully');
    } catch (error) {
      this.toast.error('Failed to save session');
    }
  }

  /**
   * Load saved state
   */
  async loadSavedState() {
    try {
      const saved = await this.storage.load('devmind_session');
      if (saved) {
        this.state.journalContent = saved.journalContent || '';
        this.state.codeContent = saved.codeContent || '';
        this.state.selectedLanguage = saved.selectedLanguage || 'javascript';
        this.state.reflectionHistory = saved.reflectionHistory || [];

        // Restore UI state
        this.components.journal.setContent(this.state.journalContent);
        this.components.codeEditor.setContent(this.state.codeContent);
        this.components.codeEditor.setLanguage(this.state.selectedLanguage);
        this.updateLanguageSelector();

        console.log('Previous session restored');
      }
    } catch (error) {
      console.error('Failed to load saved state:', error);
    }
  }

  /**
   * Auto-save functionality
   */
  autoSave() {
    clearTimeout(this.autoSaveTimeout);
    this.autoSaveTimeout = setTimeout(() => {
      this.saveSession();
    }, 5000); // Auto-save after 5 seconds of inactivity
  }

  /**
   * Set loading state
   */
  setLoading(isLoading) {
    this.state.isLoading = isLoading;
    const loadingIndicator = document.getElementById('loading-indicator');
    const reflectBtn = document.getElementById('reflect-btn');
    
    if (isLoading) {
      loadingIndicator.classList.remove('hidden');
      reflectBtn.disabled = true;
      reflectBtn.textContent = '🧠 Thinking...';
    } else {
      loadingIndicator.classList.add('hidden');
      reflectBtn.disabled = false;
      reflectBtn.textContent = '🧠 Get AI Reflection';
    }
  }

  /**
   * Show welcome message
   */
  showWelcomeMessage() {
    const welcomeMessage = `
      <div class="text-center py-8">
        <h3 class="text-2xl font-bold text-blue-400 mb-4">Welcome to DEV-MIND™</h3>
        <p class="text-gray-300 mb-4">Your AI-powered developer reflection platform</p>
        <div class="space-y-2 text-sm text-gray-400">
          <p>💡 Share your development challenges and get intelligent feedback</p>
          <p>🔍 Upload code files for contextual analysis</p>
          <p>📝 Export your sessions for future reference</p>
          <p>⚡ Use Ctrl+Enter to generate reflections quickly</p>
        </div>
      </div>
    `;
    
    this.components.reflection.setContent(welcomeMessage);
  }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  window.devMindApp = new DevMindApp();
});

// Export for debugging
window.DevMindApp = DevMindApp;