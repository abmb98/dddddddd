import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { 
  collection, 
  onSnapshot, 
  query, 
  where, 
  orderBy, 
  doc, 
  updateDoc, 
  addDoc,
  serverTimestamp,
  deleteDoc
} from 'firebase/firestore';
import { db } from '@/lib/firebase';

export interface InAppNotification {
  id: string;
  type: 'worker_duplicate' | 'worker_exit_request' | 'worker_exit_confirmed' | 'general';
  title: string;
  message: string;
  recipientId: string;
  recipientFermeId: string;
  status: 'unread' | 'read' | 'acknowledged';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  createdAt: any;
  readAt?: any;
  acknowledgedAt?: any;
  actionData?: {
    workerId?: string;
    workerName?: string;
    workerCin?: string;
    requesterFermeId?: string;
    requesterFermeName?: string;
    actionRequired?: string;
    actionUrl?: string;
  };
}

interface NotificationContextType {
  notifications: InAppNotification[];
  unreadCount: number;
  loading: boolean;
  markAsRead: (notificationId: string) => Promise<void>;
  markAsAcknowledged: (notificationId: string) => Promise<void>;
  dismissNotification: (notificationId: string) => Promise<void>;
  sendNotification: (notification: Omit<InAppNotification, 'id' | 'createdAt'>) => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<InAppNotification[]>([]);
  const [loading, setLoading] = useState(true);

  // Load notifications for current user
  useEffect(() => {
    if (!user?.uid) {
      console.log('❌ No user UID, skipping notification setup');
      setNotifications([]);
      setLoading(false);
      return;
    }

    console.log('🔄 Setting up notifications for user:', user.uid, 'Email:', user.email);

    // Use simple query without orderBy to avoid index requirement
    // Sort in memory instead
    const notificationsQuery = query(
      collection(db, 'notifications'),
      where('recipientId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(
      notificationsQuery,
      (snapshot) => {
        const notificationsData = snapshot.docs
          .map(doc => ({
            id: doc.id,
            ...doc.data()
          } as InAppNotification))
          .sort((a, b) => {
            // Sort in memory by createdAt descending
            const aTime = a.createdAt?.toDate?.() || new Date(a.createdAt || 0);
            const bTime = b.createdAt?.toDate?.() || new Date(b.createdAt || 0);
            return bTime.getTime() - aTime.getTime();
          });

        console.log('✅ Loaded notifications:', notificationsData.length);
        if (notificationsData.length > 0) {
          console.log('📝 Notification details:', notificationsData);
        }
        setNotifications(notificationsData);
        setLoading(false);
      },
      (error) => {
        console.error('❌ Error loading notifications:', error);
        console.error('Error code:', error.code);
        console.error('Error message:', error.message);

        if (error.code === 'permission-denied') {
          console.error('🚫 PERMISSION DENIED: Firestore rules are blocking notification access');
          console.error('💡 Solution: Deploy updated Firestore rules or check user authentication');
        } else if (error.code === 'unavailable') {
          console.error('🌐 FIRESTORE UNAVAILABLE: Network or service issue');
        }

        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user?.uid]);

  const unreadCount = notifications.filter(n => n.status === 'unread').length;

  const markAsRead = async (notificationId: string) => {
    try {
      const notificationRef = doc(db, 'notifications', notificationId);
      await updateDoc(notificationRef, {
        status: 'read',
        readAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAsAcknowledged = async (notificationId: string) => {
    try {
      const notificationRef = doc(db, 'notifications', notificationId);
      await updateDoc(notificationRef, {
        status: 'acknowledged',
        acknowledgedAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Error acknowledging notification:', error);
    }
  };

  const dismissNotification = async (notificationId: string) => {
    try {
      const notificationRef = doc(db, 'notifications', notificationId);
      await deleteDoc(notificationRef);
    } catch (error) {
      console.error('Error dismissing notification:', error);
    }
  };

  const sendNotification = async (notificationData: Omit<InAppNotification, 'id' | 'createdAt'>) => {
    console.log('🔄 Attempting to send notification:', {
      type: notificationData.type,
      title: notificationData.title,
      recipientId: notificationData.recipientId,
      priority: notificationData.priority
    });

    try {
      // Check if we're online
      if (!navigator.onLine) {
        console.warn('⚠️ Offline - notification will be sent when connection is restored');
        return;
      }

      // Check if user is authenticated
      if (!user?.uid) {
        console.error('❌ No authenticated user - cannot send notification');
        return;
      }

      const notificationDoc = {
        ...notificationData,
        createdAt: serverTimestamp()
      };

      console.log('📤 Sending notification document to Firestore:', notificationDoc);

      const docRef = await addDoc(collection(db, 'notifications'), notificationDoc);

      console.log('✅ Notification sent successfully with ID:', docRef.id);
      return docRef.id;
    } catch (error: any) {
      console.error('❌ Error sending notification:', error);
      console.error('Error code:', error?.code);
      console.error('Error message:', error?.message);

      // Handle specific error types
      if (error?.code === 'permission-denied') {
        console.error('🚫 Permission denied - check Firestore rules for notifications collection');
        console.log('💡 Suggestion: Deploy Firestore rules or check user permissions');
      } else if (error?.code === 'unavailable' || error?.message?.includes('Failed to fetch')) {
        console.error('🌐 Firestore unavailable - network connection issue');
      } else if (error?.code === 'failed-precondition') {
        console.error('⚙️ Firestore rules or index issue');
      }

      // Don't throw the error to prevent breaking the UI
      // The notification will fail silently but the main operation continues
      return null;
    }
  };

  const value: NotificationContextType = {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAsAcknowledged,
    dismissNotification,
    sendNotification
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};
