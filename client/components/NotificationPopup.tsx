import React, { useEffect, useState } from 'react';
import { useNotifications } from '@/contexts/NotificationContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Bell,
  X,
  CheckCircle,
  AlertTriangle,
  Info,
  ExternalLink
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

export const NotificationPopup: React.FC = () => {
  const { notifications, markAsRead } = useNotifications();
  const [isOpen, setIsOpen] = useState(false);
  const [shownNotifications, setShownNotifications] = useState<Set<string>>(new Set());

  // Show popup when there are new high priority unread notifications
  useEffect(() => {
    const highPriorityUnread = notifications.filter(n => 
      n.status === 'unread' && 
      (n.priority === 'high' || n.priority === 'urgent') &&
      !shownNotifications.has(n.id)
    );

    if (highPriorityUnread.length > 0 && !isOpen) {
      setIsOpen(true);
      // Mark these notifications as shown so they don't popup again
      setShownNotifications(prev => {
        const newSet = new Set(prev);
        highPriorityUnread.forEach(n => newSet.add(n.id));
        return newSet;
      });
    }
  }, [notifications, isOpen, shownNotifications]);

  const handleClose = () => {
    setIsOpen(false);
  };

  const handleMarkAsRead = async (notificationId: string) => {
    await markAsRead(notificationId);
  };

  const handleAction = (actionUrl?: string) => {
    if (actionUrl) {
      window.location.href = actionUrl;
    }
    setIsOpen(false);
  };

  const getIcon = (type: string, priority: string) => {
    if (priority === 'urgent') return <AlertTriangle className="h-5 w-5 text-red-600" />;
    if (priority === 'high') return <Bell className="h-5 w-5 text-orange-600" />;
    if (type === 'worker_exit_confirmed') return <CheckCircle className="h-5 w-5 text-green-600" />;
    return <Info className="h-5 w-5 text-blue-600" />;
  };

  const formatTimestamp = (timestamp: any) => {
    if (!timestamp) return '';
    
    let date;
    if (timestamp.toDate) {
      date = timestamp.toDate();
    } else if (timestamp instanceof Date) {
      date = timestamp;
    } else {
      date = new Date(timestamp);
    }
    
    return formatDistanceToNow(date, { addSuffix: true, locale: fr });
  };

  const unreadHighPriority = notifications.filter(n => 
    n.status === 'unread' && 
    (n.priority === 'high' || n.priority === 'urgent')
  );

  if (unreadHighPriority.length === 0) return null;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-orange-600" />
            Nouvelles notifications importantes
          </DialogTitle>
          <DialogDescription>
            Vous avez {unreadHighPriority.length} notification{unreadHighPriority.length > 1 ? 's' : ''} importante{unreadHighPriority.length > 1 ? 's' : ''}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 max-h-96 overflow-y-auto">
          {unreadHighPriority.slice(0, 3).map((notification) => (
            <Card key={notification.id} className="border-l-4 border-l-orange-500">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    {getIcon(notification.type, notification.priority)}
                    <CardTitle className="text-sm">
                      {notification.title}
                    </CardTitle>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleMarkAsRead(notification.id)}
                    className="h-6 w-6 p-0"
                    title="Marquer comme lu"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-sm text-gray-700 mb-2">
                  {notification.message}
                </p>
                
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>{formatTimestamp(notification.createdAt)}</span>
                  {notification.actionData?.actionUrl && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleAction(notification.actionData.actionUrl)}
                      className="h-6 text-xs"
                    >
                      <ExternalLink className="h-3 w-3 mr-1" />
                      Action
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
          
          {unreadHighPriority.length > 3 && (
            <div className="text-center text-sm text-gray-500">
              ... et {unreadHighPriority.length - 3} autre{unreadHighPriority.length - 3 > 1 ? 's' : ''} notification{unreadHighPriority.length - 3 > 1 ? 's' : ''}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <Button variant="outline" onClick={handleClose}>
            Fermer
          </Button>
          <Button onClick={() => {
            // Mark all as read
            unreadHighPriority.forEach(n => markAsRead(n.id));
            setIsOpen(false);
          }}>
            Tout marquer comme lu
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
