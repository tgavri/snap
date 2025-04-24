import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, Image, ActivityIndicator, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc, deleteDoc, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { MaterialIcons } from '@expo/vector-icons';

export default function AvatarScreen({ navigation, route }) {
    const [avatars, setAvatars] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // const user = auth.currentUser; // Temporarily removed user check

        // if (!user) { // Temporarily removed user check
        //     setLoading(false);
        //     return;
        // }

        // Listen for avatar generation documents for the current user
        const avatarsQuery = query(
            collection(db, 'avatarGenerations'),
            // where('userId', '==', user.uid), // Temporarily removed user filter
            orderBy('createdAt', 'desc')
        );

        const unsubscribe = onSnapshot(avatarsQuery, (snapshot) => {
            const avatarList = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                createdAt: doc.data().createdAt?.toDate()
            }));

            setAvatars(avatarList);
            setLoading(false);
        }, (error) => {
            console.error("Error fetching avatars:", error);
            setLoading(false);
        });

        // Cleanup subscription on unmount
        return () => unsubscribe();
    }, []);

    const handleRetry = async (avatarId) => {
        try {
            // Find the avatar document
            const avatar = avatars.find(a => a.id === avatarId);
            if (!avatar) return;

            // Update status to retry in Firestore
            await updateDoc(doc(db, 'avatarGenerations', avatarId), {
                status: 'pending'
            });

            // Trigger the avatar generation again
            if (avatar.imageData) {
                // If we have direct base64 data, use that
                processImageWithReplicate(avatar.imageData, avatarId);
            } else if (avatar.originalImageUrl) {
                // Otherwise fall back to the URL if available
                processImageWithReplicate(avatar.originalImageUrl, avatarId);
            }
        } catch (error) {
            console.error("Error retrying avatar generation:", error);
        }
    };

    const renderAvatarItem = (avatar) => {
        // Safely determine image source - checking for null or undefined URLs
        const hasValidUrl = avatar.originalImageUrl && typeof avatar.originalImageUrl === 'string';
        const hasValidData = avatar.imageData && typeof avatar.imageData === 'string';

        // Only set the source if we have valid data
        const imageSource = hasValidData
            ? { uri: avatar.imageData }
            : (hasValidUrl ? { uri: avatar.originalImageUrl } : null);

        return (
            <View style={styles.avatarItem} key={avatar.id}>
                <View style={styles.avatarPair}>
                    {/* Original Image */}
                    <View style={styles.imageContainer}>
                        <Text style={styles.label}>Original</Text>
                        {avatar.status === 'uploading' || !imageSource ? (
                            <View style={[styles.image, styles.loadingContainer]}>
                                {avatar.status === 'uploading' ? (
                                    <>
                                        <ActivityIndicator size="small" color="#0000ff" />
                                        <Text style={styles.loadingText}>Uploading...</Text>
                                    </>
                                ) : (
                                    <Text style={styles.loadingText}>No image available</Text>
                                )}
                            </View>
                        ) : (
                            <Image
                                source={imageSource}
                                style={styles.image}
                                resizeMode="cover"
                                defaultSource={require('../assets/placeholder.png')}
                            />
                        )}
                    </View>

                    {/* Generated Avatar */}
                    <View style={styles.imageContainer}>
                        <Text style={styles.label}>AI Avatar</Text>
                        {avatar.status === 'completed' && avatar.generatedImageUrl ? (
                            <Image
                                source={{ uri: avatar.generatedImageUrl }}
                                style={styles.image}
                                resizeMode="cover"
                                defaultSource={require('../assets/placeholder.png')}
                            />
                        ) : avatar.status === 'error' ? (
                            <View style={[styles.image, styles.errorContainer]}>
                                <Text style={styles.errorText}>Failed</Text>
                                {imageSource ? (
                                    <TouchableOpacity
                                        style={styles.retryButton}
                                        onPress={() => handleRetry(avatar.id)}
                                    >
                                        <MaterialIcons name="refresh" size={24} color="white" />
                                        <Text style={styles.retryText}>Retry</Text>
                                    </TouchableOpacity>
                                ) : (
                                    <Text style={styles.errorSubtext}>Image unavailable</Text>
                                )}
                            </View>
                        ) : (
                            <View style={[styles.image, styles.loadingContainer]}>
                                <ActivityIndicator size="large" color="#0000ff" />
                                <Text style={styles.loadingText}>
                                    {avatar.status === 'uploading' ? 'Uploading...' : 'Processing...'}
                                </Text>
                            </View>
                        )}
                    </View>
                </View>

                <Text style={styles.timestamp}>
                    {avatar.createdAt ? new Date(avatar.createdAt).toLocaleString() : 'Processing...'}
                </Text>

                {/* Add status and debug info */}
                <Text style={styles.debugInfo}>
                    Status: {avatar.status || 'unknown'}
                    {avatar.error ? ` - Error: ${avatar.error}` : ''}
                </Text>
            </View>
        );
    };

    // Process image with Replicate AI directly within the app
    const processImageWithReplicate = async (imageSource, avatarId) => {
        try {
            // Set status to processing to indicate we're working on it
            await updateDoc(doc(db, 'avatarGenerations', avatarId), {
                status: 'processing'
            });

            // Safety check for undefined imageSource
            if (!imageSource) {
                console.error("Image source is undefined for avatar:", avatarId);
                await updateDoc(doc(db, 'avatarGenerations', avatarId), {
                    status: 'error',
                    error: 'Missing image source'
                });
                return;
            }

            // Replace placeholder URL with real logic
            if (imageSource === "data:image/jpeg;base64,direct-upload") {
                console.error("Invalid image source (placeholder URL)");
                await updateDoc(doc(db, 'avatarGenerations', avatarId), {
                    status: 'error',
                    error: 'Invalid image source'
                });
                return;
            }


            // Determine if we're dealing with base64 data or a URL
            const isBase64 = typeof imageSource === 'string' && imageSource.startsWith('data:');

            // If it's a base64 string, make sure it's not too big (Replicate has limits)
            if (isBase64 && imageSource.length > 10000000) {  // ~10MB limit
                console.error("Base64 string too large for API");
                await updateDoc(doc(db, 'avatarGenerations', avatarId), {
                    status: 'error',
                    error: 'Image too large for processing'
                });
                return;
            }

            // Prepare the input properly
            const imageInput = isBase64 ? imageSource : { url: imageSource };

            console.log(`Processing avatar ${avatarId} with ${isBase64 ? 'base64 data' : 'URL'}`);

            const response = await fetch("https://api.replicate.com/v1/predictions", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Token ${replicateApiKey}`
                },
                body: JSON.stringify({
                    version: "798c9c78ca767f5a9bbc9b020b9c8b1c5c064fa20096688620c4eb3e6b8f2c48",
                    input: {
                        image: imageInput,
                        prompt: "Generate an anime style avatar, highly detailed portrait"
                    }
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error("Replicate API error:", response.status, errorText);
                await updateDoc(doc(db, 'avatarGenerations', avatarId), {
                    status: 'error',
                    error: `API Error: ${response.status}`
                });
                return;
            }

            const data = await response.json();

            // Poll for completion
            if (data.id) {
                console.log("Started prediction with ID:", data.id);
                checkPredictionStatus(data.id, avatarId, replicateApiKey);
            } else {
                console.error("Failed to start prediction:", data);
                await updateDoc(doc(db, 'avatarGenerations', avatarId), {
                    status: 'error',
                    error: data.error || 'Failed to start prediction'
                });
            }
        } catch (error) {
            console.error("Error processing with Replicate:", error);
            await updateDoc(doc(db, 'avatarGenerations', avatarId), {
                status: 'error',
                error: error.message || 'Unknown error'
            });
        }
    };

    // Poll for prediction status
    const checkPredictionStatus = async (predictionId, avatarId, apiKey) => {
        try {
            const response = await fetch(`https://api.replicate.com/v1/predictions/${predictionId}`, {
                method: "GET",
                headers: {
                    "Authorization": `Token ${apiKey}`
                }
            });

            const data = await response.json();

            if (data.status === 'succeeded') {
                // Update Firestore document with generated image URL
                await updateDoc(doc(db, 'avatarGenerations', avatarId), {
                    status: 'completed',
                    generatedImageUrl: data.output[0] // Assuming the output is a URL
                });
            } else if (data.status === 'failed') {
                await updateDoc(doc(db, 'avatarGenerations', avatarId), {
                    status: 'error',
                    error: data.error || 'Unknown error'
                });
            } else {
                // Still processing, check again in 2 seconds
                setTimeout(() => {
                    checkPredictionStatus(predictionId, avatarId, apiKey);
                }, 2000);
            }
        } catch (error) {
            console.error("Error checking prediction status:", error);
            await updateDoc(doc(db, 'avatarGenerations', avatarId), {
                status: 'error',
                error: error.message
            });
        }
    };

    // Process any pending avatars when the screen loads
    useEffect(() => {
        // Only process new pending avatars
        const pendingAvatars = avatars.filter(a => a.status === 'pending' && !a.generatedImageUrl);

        pendingAvatars.forEach(avatar => {
            processImageWithReplicate(avatar.originalImageUrl, avatar.id);
        });
    }, [avatars]);

    // Add reset function to clear all avatars
    const resetAllAvatars = async () => {
        Alert.alert(
            "Reset All Avatars",
            "Are you sure you want to delete all avatars? This cannot be undone.",
            [
                {
                    text: "Cancel",
                    style: "cancel"
                },
                {
                    text: "Delete All",
                    style: "destructive",
                    onPress: async () => {
                        try {
                            setLoading(true);

                            // Get all avatar documents
                            const avatarsSnapshot = await getDocs(collection(db, 'avatarGenerations'));

                            // Delete each document
                            const deletionPromises = avatarsSnapshot.docs.map(doc =>
                                deleteDoc(doc.ref)
                            );

                            await Promise.all(deletionPromises);

                            Alert.alert("Success", "All avatars have been deleted.");
                        } catch (error) {
                            console.error("Error deleting avatars:", error);
                            Alert.alert("Error", "Failed to delete all avatars.");
                        } finally {
                            setLoading(false);
                        }
                    }
                }
            ]
        );
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity
                    style={styles.cameraButton}
                    onPress={() => {
                        console.log("Navigating to Camera screen");
                        navigation.navigate('Camera');
                    }}
                >
                    <MaterialIcons name="camera-alt" size={28} color="white" />
                </TouchableOpacity>
                <Text style={styles.title}>Your AI Avatars</Text>
                <TouchableOpacity
                    style={styles.adminButton}
                    onPress={resetAllAvatars}
                >
                    <MaterialIcons name="delete-sweep" size={28} color="white" />
                </TouchableOpacity>
            </View>

            {loading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#0000ff" />
                    <Text>Loading your avatars...</Text>
                </View>
            ) : avatars.length === 0 ? (
                <View style={styles.emptyContainer}>
                    <MaterialIcons name="face" size={80} color="#ccc" />
                    <Text style={styles.emptyText}>No avatars yet</Text>
                    <Text style={styles.emptySubtext}>Take a selfie to generate your AI avatar</Text>
                    <TouchableOpacity
                        style={styles.takePictureButton}
                        onPress={() => {
                            console.log("Navigating to Camera from empty state");
                            navigation.navigate('Camera');
                        }}
                    >
                        <Text style={styles.buttonText}>Take a Picture</Text>
                    </TouchableOpacity>
                </View>
            ) : (
                <ScrollView contentContainerStyle={styles.scrollContent}>
                    {avatars.map(renderAvatarItem)}
                </ScrollView>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f5f5f5',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 15,
        paddingHorizontal: 20,
        backgroundColor: '#4a6ea9',
    },
    title: {
        fontSize: 20,
        color: 'white',
        fontWeight: 'bold',
    },
    cameraButton: {
        padding: 8,
    },
    scrollContent: {
        padding: 15,
    },
    avatarItem: {
        backgroundColor: 'white',
        borderRadius: 10,
        padding: 15,
        marginBottom: 15,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    avatarPair: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    imageContainer: {
        width: '48%',
    },
    label: {
        fontSize: 14,
        marginBottom: 5,
        color: '#555',
        fontWeight: '500',
    },
    image: {
        width: '100%',
        height: 170,
        borderRadius: 8,
        backgroundColor: '#eee',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        marginTop: 10,
        color: '#0000ff',
    },
    errorContainer: {
        backgroundColor: '#ffeeee',
        justifyContent: 'center',
        alignItems: 'center',
    },
    errorText: {
        color: '#ff0000',
        fontWeight: 'bold',
        marginBottom: 10,
    },
    retryButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#ff6b6b',
        paddingVertical: 8,
        paddingHorizontal: 15,
        borderRadius: 20,
    },
    retryText: {
        color: 'white',
        fontWeight: 'bold',
        marginLeft: 5,
    },
    timestamp: {
        marginTop: 10,
        fontSize: 12,
        color: '#888',
        textAlign: 'right',
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    emptyText: {
        fontSize: 20,
        fontWeight: 'bold',
        marginTop: 20,
        color: '#555',
    },
    emptySubtext: {
        fontSize: 16,
        color: '#888',
        textAlign: 'center',
        marginTop: 10,
        marginBottom: 30,
    },
    takePictureButton: {
        backgroundColor: '#4a6ea9',
        paddingVertical: 12,
        paddingHorizontal: 30,
        borderRadius: 25,
    },
    buttonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: 'bold',
    },
    adminButton: {
        padding: 8,
    },
    errorSubtext: {
        color: '#ff0000',
        fontWeight: 'bold',
        marginBottom: 10,
    },
    debugInfo: {
        marginTop: 10,
        fontSize: 12,
        color: '#888',
        textAlign: 'right',
    },
}); 