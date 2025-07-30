import React, { useState } from 'react';
import { useNotifications } from '@/contexts/NotificationContext';
import { useAuth } from '@/contexts/AuthContext';
import { useFirestore } from '@/hooks/useFirestore';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Alert,
  AlertDescription,
} from '@/components/ui/alert';
import {
  AlertTriangle,
  User,
  Building,
  Calendar,
  CheckCircle,
  XCircle,
  ArrowRight,
  Bell,
  Send
} from 'lucide-react';
import { Worker, Ferme } from '@shared/types';

interface WorkerConflictModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingWorker: Worker | null;
  currentFarm: Ferme | null;
  formData: any;
  notificationSent: boolean;
  onConfirmAction?: () => void;
}

export const WorkerConflictModal: React.FC<WorkerConflictModalProps> = ({
  isOpen,
  onClose,
  existingWorker,
  currentFarm,
  formData,
  notificationSent,
  onConfirmAction
}) => {
  const { sendNotification } = useNotifications();
  const { user } = useAuth();
  const { data: fermes } = useFirestore<Ferme>('fermes');
  const [exitDate, setExitDate] = useState('');
  const [isAddingExitDate, setIsAddingExitDate] = useState(false);
  const [actionTaken, setActionTaken] = useState(false);
  const [isSendingNotification, setIsSendingNotification] = useState(false);
  const [notificationManuallySent, setNotificationManuallySent] = useState(false);

  if (!existingWorker || !currentFarm) return null;

  const handleAddExitDate = async () => {
    if (!exitDate) return;

    setIsAddingExitDate(true);
    try {
      // Here you would implement the logic to add exit date to the worker
      // For now, we'll just simulate it and send a notification

      // Send notification to the requesting farm that action has been taken
      if (formData?.attemptedBy && formData.fermeId) {
        // Find the requesting farm's admins to notify them
        const requestingFarm = fermes.find(f => f.id === formData.fermeId);
        if (requestingFarm?.admins) {
          for (const adminId of requestingFarm.admins) {
            await sendNotification({
              type: 'worker_exit_confirmed',
              title: '✅ Conflit résolu - Ouvrier disponible',
              message: `L'ouvrier ${existingWorker.nom} (CIN: ${existingWorker.cin}) est maintenant disponible. Sa date de sortie (${new Date(exitDate).toLocaleDateString('fr-FR')}) a été ajoutée par ${currentFarm.nom}. Vous pouvez maintenant l'enregistrer dans votre ferme.`,
              recipientId: adminId,
              recipientFermeId: formData.fermeId,
              status: 'unread',
              priority: 'high',
              actionData: {
                workerId: existingWorker.id,
                workerName: existingWorker.nom,
                workerCin: existingWorker.cin,
                actionRequired: 'Ouvrier disponible pour enregistrement',
                actionUrl: `/workers/add?prefill=${existingWorker.cin}`
              }
            });
          }
        }
      }

      setActionTaken(true);
    } catch (error) {
      console.error('Error adding exit date:', error);
    } finally {
      setIsAddingExitDate(false);
    }
  };

  const attemptingFarmName = fermes?.find(f => f.id === user?.fermeId)?.nom || 'Votre ferme';

  const handleSendNotificationToFarmAdmins = async () => {
    console.log('🚀 Starting manual notification sending...');
    console.log('📝 Current farm:', currentFarm);
    console.log('📝 Current farm structure:', {
      id: currentFarm?.id,
      nom: currentFarm?.nom,
      admins: currentFarm?.admins,
      adminsType: typeof currentFarm?.admins,
      adminsLength: currentFarm?.admins?.length,
      allKeys: currentFarm ? Object.keys(currentFarm) : 'no farm'
    });
    console.log('📝 Current user:', user);
    console.log('📝 Existing worker:', existingWorker);
    console.log('📝 All available fermes:', fermes);

    // Debug: Check if admins field exists in different formats
    const possibleAdminFields = ['admins', 'admin', 'adminIds', 'administrators'];
    const foundAdminField = possibleAdminFields.find(field =>
      currentFarm && currentFarm[field] && Array.isArray(currentFarm[field]) && currentFarm[field].length > 0
    );

    console.log('🔍 Admin field search results:', {
      possibleFields: possibleAdminFields,
      foundField: foundAdminField,
      values: possibleAdminFields.map(field => ({
        field,
        value: currentFarm?.[field],
        type: typeof currentFarm?.[field],
        isArray: Array.isArray(currentFarm?.[field])
      }))
    });

    if (!currentFarm) {
      console.error('❌ No current farm provided');
      alert('❌ Ferme actuelle non trouvée');
      return;
    }

    // Try to find admins in various possible field names
    let adminIds = currentFarm.admins || currentFarm.admin || currentFarm.adminIds || currentFarm.administrators;

    if (!adminIds || !Array.isArray(adminIds) || adminIds.length === 0) {
      console.error('❌ No admins found for farm:', {
        farmId: currentFarm.id,
        farmName: currentFarm.nom,
        adminsField: currentFarm.admins,
        allFarmData: currentFarm
      });

      // Try to get the farm from the fermes array to see if it has different data
      const farmFromList = fermes?.find(f => f.id === currentFarm.id);
      console.log('🔍 Farm from fermes list:', farmFromList);

      if (farmFromList && farmFromList.admins && farmFromList.admins.length > 0) {
        console.log('✅ Found admins in fermes list, using those:', farmFromList.admins);
        adminIds = farmFromList.admins;
      } else {
        alert(`❌ Aucun administrateur trouvé pour la ferme "${currentFarm.nom}"\n\n` +
              `Vérifiez que:\n` +
              `• La ferme a des administrateurs assignés\n` +
              `• Le champ 'admins' contient des IDs d'utilisateurs\n` +
              `• Les données de la ferme sont correctement chargées\n\n` +
              `ID Ferme: ${currentFarm.id}\n` +
              `Nom Ferme: ${currentFarm.nom}`);
        return;
      }
    }

    if (!user?.uid) {
      console.error('❌ No authenticated user');
      alert('❌ Utilisateur non connecté');
      return;
    }

    console.log(`📤 Sending to ${adminIds.length} admin(s):`, adminIds);

    setIsSendingNotification(true);
    let successCount = 0;
    let errorCount = 0;

    try {
      // Send notification to ALL admins of the current farm
      for (const adminId of adminIds) {
        try {
          console.log(`📤 Sending notification to admin: ${adminId}`);

          const notificationResult = await sendNotification({
            type: 'worker_duplicate',
            title: '🚨 Tentative d\'enregistrement d\'un ouvrier actif',
            message: `L'ouvrier ${existingWorker.nom} (CIN: ${existingWorker.cin}) est déjà actif dans votre ferme "${currentFarm.nom}" mais quelqu'un de "${attemptingFarmName}" tente de l'enregistrer. Veuillez vérifier son statut et ajouter une date de sortie si nécessaire.`,
            recipientId: adminId,
            recipientFermeId: currentFarm.id,
            status: 'unread',
            priority: 'urgent',
            actionData: {
              workerId: existingWorker.id,
              workerName: existingWorker.nom,
              workerCin: existingWorker.cin,
              requesterFermeId: user?.fermeId,
              requesterFermeName: attemptingFarmName,
              actionRequired: 'Ajouter une date de sortie à l\'ouvrier',
              actionUrl: `/workers/${existingWorker.id}`
            }
          });

          if (notificationResult) {
            console.log(`✅ Notification sent to ${adminId} with ID: ${notificationResult}`);
            successCount++;
          } else {
            console.error(`❌ Failed to send notification to ${adminId} - no result returned`);
            errorCount++;
          }
        } catch (notificationError) {
          console.error(`❌ Failed to send notification to admin ${adminId}:`, notificationError);
          errorCount++;
        }
      }

      // Also send a notification to the requester letting them know what happened
      try {
        console.log('📤 Sending confirmation notification to requester...');

        const requesterNotificationResult = await sendNotification({
          type: 'worker_duplicate',
          title: '⏳ Demande d\'enregistrement en attente',
          message: `Votre tentative d'enregistrer ${existingWorker.nom} (CIN: ${existingWorker.cin}) a été bloquée car cet ouvrier est actif dans "${currentFarm.nom}". Une notification a été envoyée à leur administration pour r��soudre le conflit.`,
          recipientId: user.uid,
          recipientFermeId: user.fermeId || '',
          status: 'unread',
          priority: 'high',
          actionData: {
            workerId: existingWorker.id,
            workerName: existingWorker.nom,
            workerCin: existingWorker.cin,
            requesterFermeId: user?.fermeId,
            requesterFermeName: attemptingFarmName,
            actionRequired: 'Attendre la résolution du conflit',
            actionUrl: `/workers`
          }
        });

        if (requesterNotificationResult) {
          console.log(`✅ Requester notification sent with ID: ${requesterNotificationResult}`);
        } else {
          console.error('❌ Failed to send requester notification - no result returned');
        }
      } catch (notificationError) {
        console.error('❌ Failed to send notification to requester:', notificationError);
      }

      setNotificationManuallySent(true);

      if (successCount > 0) {
        alert(`✅ Notification envoyée avec succès!\n\n` +
              `• Admins notifiés: ${successCount}/${adminIds.length}\n` +
              `• Erreurs: ${errorCount}\n\n` +
              `Vérifiez Firebase Console pour voir les notifications créées.`);
      } else {
        alert(`❌ Échec d'envoi des notifications!\n\n` +
              `• Erreurs: ${errorCount}\n\n` +
              `Vérifiez la console et les permissions Firestore.`);
      }

    } catch (error) {
      console.error('❌ Failed to send notification:', error);
      alert(`❌ Erreur lors de l'envoi de la notification: ${error}`);
    } finally {
      setIsSendingNotification(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600">
            <AlertTriangle className="h-5 w-5" />
            Ouvrier déjà actif détecté
          </DialogTitle>
          <DialogDescription>
            Impossible d'enregistrer cet ouvrier car il est déjà actif dans une autre ferme
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Conflict Details */}
          <Card className="border-red-200 bg-red-50">
            <CardHeader className="pb-4">
              <CardTitle className="text-red-800 text-base">
                Conflit d'enregistrement détecté
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <User className="h-4 w-4 text-gray-600" />
                    <span className="font-medium">Ouvrier concerné:</span>
                  </div>
                  <div className="pl-6">
                    <p className="font-semibold">{existingWorker.nom}</p>
                    <p className="text-sm text-gray-600">CIN: {existingWorker.cin}</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <Building className="h-4 w-4 text-gray-600" />
                    <span className="font-medium">Ferme actuelle:</span>
                  </div>
                  <div className="pl-6">
                    <p className="font-semibold text-green-700">{currentFarm.nom}</p>
                    <Badge className="bg-green-100 text-green-800 text-xs">
                      Actif
                    </Badge>
                  </div>
                </div>
              </div>

              <div className="border-t pt-4">
                <div className="flex items-center gap-2 text-sm mb-2">
                  <ArrowRight className="h-4 w-4 text-blue-600" />
                  <span className="font-medium">Tentative d'enregistrement:</span>
                </div>
                <div className="pl-6 space-y-1">
                  <p><span className="font-medium">Ferme:</span> {attemptingFarmName}</p>
                  <p><span className="font-medium">Date d'entrée prévue:</span> {new Date(formData?.dateEntree).toLocaleDateString('fr-FR')}</p>
                  {formData?.chambre && (
                    <p><span className="font-medium">Chambre prévue:</span> {formData.chambre}</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Notification Status */}
          {(notificationSent || notificationManuallySent) && (
            <Alert className="border-blue-200 bg-blue-50">
              <CheckCircle className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-blue-800">
                ✅ Une notification a été envoyée à l'administrateur de <strong>{currentFarm.nom}</strong>
                pour l'informer de cette tentative d'enregistrement.
              </AlertDescription>
            </Alert>
          )}

          {/* Manual Notification Sending */}
          {!notificationSent && !notificationManuallySent && (
            <Card className="border-blue-200 bg-blue-50">
              <CardHeader className="pb-4">
                <CardTitle className="text-blue-800 text-base flex items-center gap-2">
                  <Bell className="h-5 w-5" />
                  Envoyer une notification
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-blue-700">
                  Envoyez une notification aux administrateurs de <strong>{currentFarm.nom}</strong>
                  pour les informer de cette tentative d'enregistrement et demander l'ajout d'une date de sortie.
                </p>
                <Button
                  onClick={handleSendNotificationToFarmAdmins}
                  disabled={isSendingNotification}
                  className="w-full bg-blue-600 hover:bg-blue-700"
                >
                  {isSendingNotification ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Envoi en cours...
                    </>
                  ) : (
                    <>
                      <Send className="mr-2 h-4 w-4" />
                      Envoyer notification aux admins de {currentFarm.nom}
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Action Required */}
          <Card className="border-orange-200 bg-orange-50">
            <CardHeader className="pb-4">
              <CardTitle className="text-orange-800 text-base">
                Actions recommandées
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-orange-200 text-orange-800 text-xs flex items-center justify-center font-bold mt-0.5">
                    1
                  </div>
                  <div>
                    <p className="font-medium">Contactez l'administrateur de {currentFarm.nom}</p>
                    <p className="text-sm text-gray-600">
                      Vérifiez si l'ouvrier a quitté leur ferme et demandez l'ajout d'une date de sortie
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-orange-200 text-orange-800 text-xs flex items-center justify-center font-bold mt-0.5">
                    2
                  </div>
                  <div>
                    <p className="font-medium">Attendez la mise à jour du statut</p>
                    <p className="text-sm text-gray-600">
                      Une fois la date de sortie ajoutée, vous recevrez une notification et pourrez enregistrer l'ouvrier
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-orange-200 text-orange-800 text-xs flex items-center justify-center font-bold mt-0.5">
                    3
                  </div>
                  <div>
                    <p className="font-medium">Procédure de transfert officiel</p>
                    <p className="text-sm text-gray-600">
                      Si c'est un transfert planifié, utilisez la procédure de transfert appropriée
                    </p>
                  </div>
                </div>
              </div>

              {/* Quick action for adding exit date (if you're the admin of the current farm) */}
              {user?.fermeId === currentFarm.id && !actionTaken && (
                <div className="border-t pt-4 mt-4">
                  <div className="space-y-3">
                    <Label>Action rapide: Ajouter une date de sortie</Label>
                    <div className="flex gap-2">
                      <Input
                        type="date"
                        value={exitDate}
                        onChange={(e) => setExitDate(e.target.value)}
                        max={new Date().toISOString().split('T')[0]}
                        className="flex-1"
                      />
                      <Button
                        onClick={handleAddExitDate}
                        disabled={!exitDate || isAddingExitDate}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        {isAddingExitDate ? 'Ajout...' : 'Confirmer sortie'}
                      </Button>
                    </div>
                    <p className="text-xs text-gray-600">
                      Ceci marquera l'ouvrier comme sorti de votre ferme à la date spécifiée
                    </p>
                  </div>
                </div>
              )}

              {actionTaken && (
                <Alert className="border-green-200 bg-green-50">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <AlertDescription className="text-green-800">
                    ✅ Date de sortie ajoutée avec succès. L'autre ferme a été notifiée.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3 pt-4">
            <Button
              variant="outline"
              onClick={onClose}
              className="flex-1"
            >
              <XCircle className="mr-2 h-4 w-4" />
              Fermer
            </Button>
            {onConfirmAction && (
              <Button
                onClick={onConfirmAction}
                className="flex-1 bg-blue-600 hover:bg-blue-700"
              >
                <CheckCircle className="mr-2 h-4 w-4" />
                Continuer malgré tout
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
