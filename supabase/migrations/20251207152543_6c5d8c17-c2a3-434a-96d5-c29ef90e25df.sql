-- Créer le bucket pour les messages audio
INSERT INTO storage.buckets (id, name, public)
VALUES ('audio-messages', 'audio-messages', true);

-- Politique pour permettre aux utilisateurs authentifiés de télécharger des fichiers audio
CREATE POLICY "Authenticated users can upload audio"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'audio-messages' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Politique pour permettre à tout le monde de voir les fichiers audio (bucket public)
CREATE POLICY "Anyone can view audio messages"
ON storage.objects
FOR SELECT
USING (bucket_id = 'audio-messages');

-- Politique pour permettre aux utilisateurs de supprimer leurs propres fichiers
CREATE POLICY "Users can delete their own audio"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'audio-messages' AND auth.uid()::text = (storage.foldername(name))[1]);