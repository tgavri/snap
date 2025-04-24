import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ActivityIndicator, Alert, Image, Platform, Button } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { ref, uploadBytes, getDownloadURL, uploadString } from "firebase/storage"; // Added uploadString
import { collection, addDoc, serverTimestamp, updateDoc, doc } from "firebase/firestore"; // Firestore functions
import { storage, db } from '../firebase'; // Removed auth import
import { MaterialIcons } from '@expo/vector-icons'; // For icons
import * as FileSystem from 'expo-file-system'; // Add for file reading

export default function CameraScreen({ navigation }) {
    // Remove Camera permissions, add ImagePicker permissions state
    // const [permission, requestPermission] = useCameraPermissions();
    const [libraryPermission, setLibraryPermission] = useState(null);
    const [cameraPermission, setCameraPermission] = useState(null);

    // Remove facing state and cameraRef
    // const [facing, setFacing] = useState('front'); 
    // const cameraRef = useRef(null); 

    const [isProcessing, setIsProcessing] = useState(false); // Loading indicator state
    const [selectedImageUri, setSelectedImageUri] = useState(null); // To display the selected image

    // 1. Request Permissions on Load
    useEffect(() => {
        (async () => {
            const libraryStatus = await ImagePicker.requestMediaLibraryPermissionsAsync();
            setLibraryPermission(libraryStatus.status === 'granted');

            const cameraStatus = await ImagePicker.requestCameraPermissionsAsync();
            setCameraPermission(cameraStatus.status === 'granted');

            if (libraryStatus.status !== 'granted') {
                Alert.alert('Permission Required', 'We need access to your photo library to select photos.');
            }
            if (cameraStatus.status !== 'granted') {
                Alert.alert('Permission Required', 'We need access to your camera to take photos.');
            }
        })();
    }, []);


    // 2. Function to Flip Camera - Removed as not needed with ImagePicker
    // function toggleCameraFacing() { ... }


    // 3. Pick Image from Library
    const pickImageAsync = async () => {
        if (!libraryPermission) {
            Alert.alert('Permission Required', 'Please grant photo library permission in settings.');
            return;
        }
        let result = await ImagePicker.launchImageLibraryAsync({
            allowsEditing: true,
            quality: 0.5,
        });

        if (!result.canceled) {
            setSelectedImageUri(result.assets[0].uri);
            console.log("Image selected from library:", result.assets[0].uri);
        } else {
            Alert.alert("You did not select any image.");
        }
    };

    // 4. Take Photo with Camera
    const takePhotoAsync = async () => {
        if (!cameraPermission) {
            Alert.alert('Permission Required', 'Please grant camera permission in settings.');
            return;
        }
        let result = await ImagePicker.launchCameraAsync({
            allowsEditing: true,
            quality: 0.5,
        });

        if (!result.canceled) {
            setSelectedImageUri(result.assets[0].uri);
            console.log("Photo taken with camera:", result.assets[0].uri);
        } else {
            Alert.alert("You did not take any photo.");
        }
    };


    // 5. Function to Upload Image and Create Firestore Job (Keep existing function)
    const handleImageUpload = async (imageUri) => {
        // Using a placeholder ID for now
        const placeholderUserId = "test-user-id";

        try {
            console.log("Creating initial document...");

            // Generate a unique ID for the image
            const imageId = `${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;

            // Create a temporary Firestore document first to store metadata
            const docRef = await addDoc(collection(db, "avatarGenerations"), {
                userId: placeholderUserId,
                status: "uploading",
                createdAt: serverTimestamp(),
                prompt: "Generate an anime style avatar, highly detailed portrait",
                generatedImageUrl: null,
                originalImageUrl: null, // Will be updated after upload
                uploadId: imageId,
                uploadAttempts: 0,
                platform: Platform.OS
            });

            console.log("Created initial document with ID:", docRef.id);

            // Return the document ID immediately so UI can show progress
            return docRef.id;

        } catch (error) {
            console.error("Error creating document: ", error);

            if (error.code) {
                console.error("Error code:", error.code);
            }
            if (error.message) {
                console.error("Error message:", error.message);
            }

            // Re-throw the error to be caught by the caller
            throw error;
        }
    };

    // 6. Background Upload Function (Keep existing function)
    const completeImageUploadInBackground = async (imageUri, docId) => {
        try {
            // This will run after the UI has already navigated away
            console.log("Starting background upload for document:", docId);

            // Instead of storing the full image in Firestore, we'll upload it to Storage now
            const timestamp = Date.now();
            const filename = `${timestamp}.jpg`;
            const uploadPath = `avatar-requests/test-user-id/${filename}`;
            const storageRef = ref(storage, uploadPath);

            // Use XMLHttpRequest for iOS compatibility
            const xhr = new XMLHttpRequest();
            xhr.open('GET', imageUri, true);
            xhr.responseType = 'blob';

            // Wrap in promise
            const uploadPromise = new Promise((resolve, reject) => {
                xhr.onload = async function () {
                    if (xhr.status === 200) {
                        const imageBlob = xhr.response;
                        console.log(`XHR Blob created - Size: ${imageBlob.size}, Type: ${imageBlob.type}`);

                        try {
                            // Upload the blob to Storage
                            const metadata = { contentType: 'image/jpeg' };
                            const uploadResult = await uploadBytes(storageRef, imageBlob, metadata);
                            console.log("Upload successful:", uploadResult);

                            // Get download URL
                            const downloadURL = await getDownloadURL(uploadResult.ref);
                            console.log('File available at', downloadURL);

                            resolve(downloadURL);
                        } catch (uploadError) {
                            console.error("Upload error:", uploadError);
                            // Propagate the specific Firebase error
                            reject(uploadError);
                        }
                    } else {
                        console.error("XHR Error:", xhr.status);
                        reject(new Error(`Failed to fetch image: ${xhr.status}`));
                    }
                };

                xhr.onerror = function () {
                    console.error("XHR network error");
                    reject(new Error('Network error during image fetch'));
                };
            });

            xhr.send();

            // Wait for upload to complete
            const downloadURL = await uploadPromise;

            // Update the document with just the URL (not the full image data)
            await updateDoc(doc(db, "avatarGenerations", docId), {
                status: "pending",
                originalImageUrl: downloadURL
            });

            console.log("Background upload completed for document:", docId);
        } catch (error) {
            console.error("Background upload error:", error);

            // Update the document to show the error
            try {
                await updateDoc(doc(db, "avatarGenerations", docId), {
                    status: "error",
                    error: error.message || "Upload failed",
                    // Include Firebase error code if available
                    errorCode: error.code || null
                });
            } catch (updateError) {
                console.error("Failed to update error status:", updateError);
            }
        }
    };

    // 7. Function to handle the selected/taken picture
    const processAndUploadImage = async () => {
        if (!selectedImageUri) {
            Alert.alert("No Image", "Please select or take a photo first.");
            return;
        }
        if (isProcessing) return; // Prevent double taps

        setIsProcessing(true); // Show loading indicator
        try {
            console.log("Processing image:", selectedImageUri);

            // Handle the captured photo - create document only
            const docId = await handleImageUpload(selectedImageUri);

            // Schedule background upload (will happen after navigation)
            // Use requestAnimationFrame to ensure navigation happens first
            requestAnimationFrame(() => {
                completeImageUploadInBackground(selectedImageUri, docId);
            });


            // Show success message and navigate immediately
            Alert.alert('Success!', 'Your photo is being processed for avatar generation.');
            navigation.navigate('Avatar', { newAvatarId: docId });
        } catch (error) {
            console.error("Error processing or uploading picture: ", error);
            Alert.alert('Error', 'Could not process the photo. Please try again.');
        } finally {
            // Reset image and hide loading indicator *after* potential navigation
            // Use timeout to ensure UI updates after navigation
            setTimeout(() => {
                setSelectedImageUri(null);
                setIsProcessing(false);
            }, 500);
        }
    };


    // --- Render Logic ---

    // Permissions Loading State (Optional, can add if needed)
    // if (libraryPermission === null || cameraPermission === null) {
    //     return <View style={styles.center}><ActivityIndicator /></View>;
    // }

    // Permissions Not Granted State (Show buttons to request again or guide to settings)
    if (libraryPermission === false && cameraPermission === false) {
        return (
            <View style={styles.center}>
                <Text style={{ textAlign: 'center', color: 'white', marginBottom: 10 }}>
                    We need access to your camera and photo library. Please grant permissions in your device settings.
                </Text>
                {/* Optionally add buttons to re-request or open settings */}
            </View>
        );
    }


    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity
                    style={styles.backButton}
                    onPress={() => {
                        console.log("Navigating back to Avatar screen");
                        navigation.navigate('Avatar');
                    }}
                >
                    <MaterialIcons name="arrow-back" size={28} color="white" />
                </TouchableOpacity>
                <Text style={styles.title}>{selectedImageUri ? "Confirm Photo" : "Select Photo"}</Text>
                <View style={{ width: 40 }} />
            </View>

            <View style={styles.content}>
                {selectedImageUri ? (
                    <Image source={{ uri: selectedImageUri }} style={styles.previewImage} />
                ) : (
                    <Text style={styles.placeholderText}>Select an image from your library or take a new photo.</Text>
                )}

                <View style={styles.buttonRow}>
                    <TouchableOpacity style={styles.actionButton} onPress={pickImageAsync} disabled={isProcessing}>
                        <MaterialIcons name="photo-library" size={28} color="white" />
                        <Text style={styles.buttonText}>Library</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.actionButton} onPress={takePhotoAsync} disabled={isProcessing}>
                        <MaterialIcons name="camera-alt" size={28} color="white" />
                        <Text style={styles.buttonText}>Camera</Text>
                    </TouchableOpacity>
                </View>

                {selectedImageUri && (
                    <TouchableOpacity
                        style={[styles.confirmButton, isProcessing ? styles.disabledButton : {}]}
                        onPress={processAndUploadImage}
                        disabled={isProcessing}
                    >
                        {isProcessing ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <Text style={styles.confirmButtonText}>Generate Avatar</Text>
                        )}
                    </TouchableOpacity>
                )}
                {selectedImageUri && !isProcessing && (
                    <TouchableOpacity
                        style={styles.cancelButton}
                        onPress={() => setSelectedImageUri(null)} // Clear selection
                    >
                        <Text style={styles.cancelButtonText}>Cancel</Text>
                    </TouchableOpacity>
                )}

            </View>
        </View>
    );
}

// --- Styles --- Adjust styles as needed ---
const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#222', // Dark background
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingTop: Platform.OS === 'ios' ? 50 : 40, // Adjust for status bar
        paddingBottom: 15,
        paddingHorizontal: 15,
        backgroundColor: '#111', // Slightly darker header
        borderBottomWidth: 1,
        borderBottomColor: '#333',
    },
    backButton: {
        padding: 5,
    },
    title: {
        color: 'white',
        fontSize: 20,
        fontWeight: 'bold',
    },
    content: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    previewImage: {
        width: 300,
        height: 300,
        borderRadius: 10,
        marginBottom: 30,
        backgroundColor: '#444', // Placeholder background
    },
    placeholderText: {
        color: '#aaa',
        fontSize: 16,
        textAlign: 'center',
        marginBottom: 30,
        width: 300, // Match image width
        height: 300, // Match image height
        textAlignVertical: 'center',
        backgroundColor: '#333',
        borderRadius: 10,
    },
    buttonRow: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        width: '80%',
        marginBottom: 30,
    },
    actionButton: {
        backgroundColor: '#007AFF', // Blue action button
        paddingVertical: 12,
        paddingHorizontal: 20,
        borderRadius: 8,
        alignItems: 'center',
        minWidth: 100,
    },
    buttonText: {
        color: 'white',
        fontSize: 16,
        marginTop: 5,
    },
    confirmButton: {
        backgroundColor: '#34C759', // Green confirm button
        paddingVertical: 15,
        paddingHorizontal: 30,
        borderRadius: 8,
        alignItems: 'center',
        width: '80%',
        marginBottom: 15,
    },
    confirmButtonText: {
        color: 'white',
        fontSize: 18,
        fontWeight: 'bold',
    },
    cancelButton: {
        // Style for a less prominent cancel button
        paddingVertical: 10,
    },
    cancelButtonText: {
        color: '#aaa',
        fontSize: 16,
    },
    disabledButton: {
        opacity: 0.6,
    },
    // Keep center style for potential loading/permission messages
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#222',
        paddingHorizontal: 20,
    },
    permissionButton: { // Reuse for potential re-request button
        backgroundColor: '#007AFF',
        paddingVertical: 12,
        paddingHorizontal: 25,
        borderRadius: 8,
        marginTop: 15,
    },
    permissionButtonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: 'bold',
    },
});

// Remove old CameraView styles
/*
const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        backgroundColor: 'black', // Keep background black
    },
    camera: {
        flex: 1,
    },
    header: {
        position: 'absolute',
        top: Platform.OS === 'ios' ? 50 : 40, // Adjust for status bar
        left: 0,
        right: 0,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 15,
        zIndex: 1, // Ensure header is above camera view
        backgroundColor: 'rgba(0,0,0,0.4)', // Semi-transparent background
        paddingBottom: 10,
    },
    backButton: {
        padding: 5,
    },
    title: {
        color: 'white',
        fontSize: 20,
        fontWeight: 'bold',
    },
    buttonContainer: {
        flex: 1,
        flexDirection: 'row',
        backgroundColor: 'transparent',
        margin: 64,
        justifyContent: 'space-between', // Space out buttons
        alignItems: 'flex-end', // Align buttons to the bottom
    },
    button: {
        alignSelf: 'flex-end',
        alignItems: 'center',
        padding: 10,
        borderRadius: 50, // Make buttons circular
        backgroundColor: 'rgba(0,0,0,0.5)', // Semi-transparent background
    },
    captureButton: {
        width: 70, // Larger capture button
        height: 70,
        borderRadius: 35,
        justifyContent: 'center',
        borderWidth: 3,
        borderColor: 'white',
        marginBottom: -5, // Adjust position slightly if needed
        backgroundColor: 'rgba(200,0,0,0.5)', // Reddish tint
    },
    text: {
        fontSize: 24,
        fontWeight: 'bold',
        color: 'white',
    },
    center: { // Reusing center style for permission view
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'black',
        paddingHorizontal: 20,
    },
    permissionButton: {
        backgroundColor: '#007AFF', // iOS blue
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderRadius: 5,
        marginTop: 15,
    },
    permissionButtonText: {
        color: 'white',
        fontSize: 16,
    },
});
*/
