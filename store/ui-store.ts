import { create } from 'zustand';

interface UIState {
  // Navigation
  isMobileMenuOpen: boolean;
  activeTab: string;
  
  // Modals
  isProjectFormOpen: boolean;
  isProfileEditOpen: boolean;
  
  // Chat
  activeChatThread: string | null;
  isChatSidebarOpen: boolean;
  
  // Notifications
  notifications: Array<{
    id: string;
    type: 'success' | 'error' | 'info' | 'warning';
    title: string;
    message: string;
    createdAt: Date;
  }>;
  
  // Actions
  setMobileMenuOpen: (open: boolean) => void;
  setActiveTab: (tab: string) => void;
  setProjectFormOpen: (open: boolean) => void;
  setProfileEditOpen: (open: boolean) => void;
  setActiveChatThread: (threadId: string | null) => void;
  setChatSidebarOpen: (open: boolean) => void;
  addNotification: (notification: Omit<UIState['notifications'][0], 'id' | 'createdAt'>) => void;
  removeNotification: (id: string) => void;
}

export const useUIStore = create<UIState>((set) => ({
  isMobileMenuOpen: false,
  activeTab: 'projects',
  isProjectFormOpen: false,
  isProfileEditOpen: false,
  activeChatThread: null,
  isChatSidebarOpen: true,
  notifications: [],
  
  setMobileMenuOpen: (open) => set({ isMobileMenuOpen: open }),
  setActiveTab: (tab) => set({ activeTab: tab }),
  setProjectFormOpen: (open) => set({ isProjectFormOpen: open }),
  setProfileEditOpen: (open) => set({ isProfileEditOpen: open }),
  setActiveChatThread: (threadId) => set({ activeChatThread: threadId }),
  setChatSidebarOpen: (open) => set({ isChatSidebarOpen: open }),
  
  addNotification: (notification) => set((state) => ({
    notifications: [
      ...state.notifications,
      {
        ...notification,
        id: Math.random().toString(36).substring(2),
        createdAt: new Date(),
      }
    ]
  })),
  
  removeNotification: (id) => set((state) => ({
    notifications: state.notifications.filter(n => n.id !== id)
  })),
}));