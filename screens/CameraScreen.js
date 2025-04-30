import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ActivityIndicator, Alert, Image, Platform, Button } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { ref, getDownloadURL, uploadBytesResumable } from "firebase/storage";
import { collection, addDoc, serverTimestamp, updateDoc, doc } from "firebase/firestore";
import { storage, db } from '../firebase';
import { MaterialIcons } from '@expo/vector-icons';

// Separate helper function for upload logic - Simplified Error Handling
async function uploadImageAndGetUrl(uri) {
    console.log("Inside uploadImageAndGetUrl, URI:", uri);
    // Removed internal try...catch
    const response = await fetch(uri);
    if (!response.ok) {
        // Let this throw
        throw new Error(`Helper: Failed to fetch image: ${response.status} ${response.statusText}`);
    }
    const imageBlob = await response.blob();
    console.log(`Helper: Blob created - Size: ${imageBlob.size}, Type: ${imageBlob.type}`);

    const timestamp = Date.now();
    const uniqueNamePart = Math.random().toString(36).substring(2, 10);
    const originalFileName = uri.substring(uri.lastIndexOf('/') + 1);
    const filename = `${timestamp}_${uniqueNamePart}_${originalFileName}`;
    const uploadPath = `uploads/${filename}`;
    const storageRef = ref(storage, uploadPath);

    console.log("Helper: Starting upload to (test path):", uploadPath);
    const uploadTaskSnapshot = await uploadBytesResumable(storageRef, imageBlob);
    console.log("Helper: Upload Task Completed. State:", uploadTaskSnapshot.state);

    if (uploadTaskSnapshot.state !== 'success') {
        // Let this throw
        throw new Error(`Helper: Upload failed with state: ${uploadTaskSnapshot.state}`);
    }

    const downloadURL = await getDownloadURL(storageRef);
    console.log('Helper: Upload successful! File available at', downloadURL);
    return { downloadURL, uploadPath };
}

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

            if (libraryStatus.status !== 'granted' || cameraStatus.status !== 'granted') {
                Alert.alert('Permission Required', 'Camera or Photo Library permission is needed.');
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
            quality: 0.1, // Keep quality low for testing
        });

        if (!result.canceled) {
            setSelectedImageUri(result.assets[0].uri);
            console.log("Image selected:", result.assets[0].uri);
            // Log dimensions if available
            if (result.assets[0].width && result.assets[0].height) {
                console.log(`Selected Image Dimensions: ${result.assets[0].width}x${result.assets[0].height}`);
            }
        } else {
            console.log("User cancelled image picker");
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
            quality: 0.1, // Keep quality low for testing
        });

        if (!result.canceled) {
            setSelectedImageUri(result.assets[0].uri);
            console.log("Photo taken:", result.assets[0].uri);
            // Log dimensions if available
            if (result.assets[0].width && result.assets[0].height) {
                console.log(`Taken Photo Dimensions: ${result.assets[0].width}x${result.assets[0].height}`);
            }
        } else {
            console.log("User cancelled camera");
        }
    };


    // 5. Renamed Function to Create Firestore Record (runs *after* upload)
    const createFirestoreRecord = async (originalImageUrl, uploadPath, uploadId) => {
        const placeholderUserId = "public-user"; // Consistent placeholder
        try {
            console.log(`Creating Firestore record for: ${originalImageUrl}`);
            const docRef = await addDoc(collection(db, "avatarGenerations"), {
                userId: placeholderUserId,
                status: "pending", // Set to pending, as upload is done
                createdAt: serverTimestamp(),
                prompt: "Generate an anime style avatar, highly detailed portrait",
                generatedImageUrl: null,
                originalImageUrl: originalImageUrl, // Store the actual URL
                originalImageStoragePath: uploadPath, // Store the path too
                uploadId: uploadId, // Store the unique upload ID
                uploadAttempts: 1, // Since we succeeded once
                platform: Platform.OS
            });
            console.log("Created Firestore document with ID:", docRef.id);
            return docRef.id; // Return the new document ID
        } catch (error) {
            console.error("Error creating Firestore document: ", error);
            // Don't throw here, let the main function handle UI alert
            return null;
        }
    };

    // 7. Full Upload and Firestore Record Creation Function
    const processAndUploadImage = async () => {
        if (!selectedImageUri) {
            Alert.alert("No Image", "Please select or take a photo first.");
            return;
        }
        if (isProcessing) return; // Prevent double taps

        setIsProcessing(true);
        console.log("--- Starting Upload and Firestore Record Creation --- ");
        console.log("Selected image URI:", selectedImageUri);

        let uploadId = `${Date.now()}-${Math.random().toString(36).substring(2, 10)}`; // Unique ID for this attempt

        try {
            // Step 1: Upload the image
            console.log(`Attempting upload (ID: ${uploadId}) for:`, selectedImageUri);
            const { downloadURL, uploadPath } = await uploadImageAndGetUrl(selectedImageUri);
            console.log(`Upload successful (ID: ${uploadId}). URL: ${downloadURL}, Path: ${uploadPath}`);

            // Step 2: Create the Firestore record
            console.log(`Creating Firestore record (ID: ${uploadId})...`);
            const docId = await createFirestoreRecord(downloadURL, uploadPath, uploadId);

            if (docId) {
                console.log(`Firestore record created successfully (Doc ID: ${docId}, Upload ID: ${uploadId}).`);
                Alert.alert("Upload Complete", "Your image has been uploaded and is being processed.");
                // Navigate back to Avatar screen after successful upload and record creation
                navigation.navigate('Avatar');
                setSelectedImageUri(null); // Clear the preview
            } else {
                // Error handled within createFirestoreRecord, but we need to stop processing
                console.error(`Failed to create Firestore record (Upload ID: ${uploadId}).`);
                Alert.alert("Upload Error", "Could not save upload details. Please try again.");
            }

        } catch (error) {
            console.error(`Error during upload or Firestore creation (Upload ID: ${uploadId}):`, error);
            Alert.alert("Upload Failed", `An error occurred during upload: ${error.message || 'Unknown error'}. Please try again.`);
            // Consider adding retry logic here or letting the user retry manually
        } finally {
            setIsProcessing(false); // Ensure loading indicator is always turned off
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
                            <Text style={styles.confirmButtonText}>Confirm & Upload</Text>
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
