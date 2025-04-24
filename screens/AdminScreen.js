import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Button, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { storage, db } from '../firebase';
import { ref, uploadString, getDownloadURL } from 'firebase/storage';

/**
 * This is an admin screen to help diagnose Firebase Storage issues
 */
export default function AdminScreen({ navigation }) {
    const [testResults, setTestResults] = useState([]);
    const [isLoading, setIsLoading] = useState(false);

    // Run a series of tests to diagnose Firebase Storage
    const runTests = async () => {
        setIsLoading(true);
        setTestResults([]);

        try {
            // Test 1: Firebase Configuration
            addResult('Firebase Config Test', 'Started');

            // Check if storage is initialized
            if (!storage) {
                addResult('Firebase Config Test', 'Failed - Storage not initialized');
            } else {
                const bucket = storage.app.options.storageBucket;
                addResult('Firebase Config Test', `Passed - Bucket: ${bucket}`);
            }

            // Test 2: Simple string upload
            addResult('String Upload Test', 'Started');
            try {
                const testMessage = `Test message ${new Date().toISOString()}`;
                const testPath = `test/string-test-${Date.now()}.txt`;
                const testRef = ref(storage, testPath);

                const uploadResult = await uploadString(testRef, testMessage);
                const downloadURL = await getDownloadURL(uploadResult.ref);

                addResult('String Upload Test', `Passed - URL: ${downloadURL}`);
            } catch (stringError) {
                addResult('String Upload Test', `Failed - ${stringError.code}: ${stringError.message}`);
            }

            // Test 3: Image Base64 upload
            addResult('Image Upload Test', 'Started');
            try {
                // A tiny 1x1 transparent PNG as base64
                const tinyImage = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
                const imagePath = `test/image-test-${Date.now()}.png`;
                const imageRef = ref(storage, imagePath);

                const metadata = {
                    contentType: 'image/png'
                };

                const uploadResult = await uploadString(imageRef, tinyImage, 'base64', metadata);
                const downloadURL = await getDownloadURL(uploadResult.ref);

                addResult('Image Upload Test', `Passed - URL: ${downloadURL}`);
            } catch (imageError) {
                addResult('Image Upload Test', `Failed - ${imageError.code}: ${imageError.message}`);
            }

            // Test 4: Avatar folder test
            addResult('Avatar Folder Test', 'Started');
            try {
                const testMessage = `Avatar test ${new Date().toISOString()}`;
                const avatarPath = `avatar-requests/test-user-id/test-${Date.now()}.txt`;
                const avatarRef = ref(storage, avatarPath);

                const uploadResult = await uploadString(avatarRef, testMessage);
                const downloadURL = await getDownloadURL(uploadResult.ref);

                addResult('Avatar Folder Test', `Passed - URL: ${downloadURL}`);
            } catch (avatarError) {
                addResult('Avatar Folder Test', `Failed - ${avatarError.code}: ${avatarError.message}`);

                // Show alert with detailed error info
                Alert.alert(
                    'Avatar Folder Test Failed',
                    `This is the specific folder where your application is failing.\n\nError: ${avatarError.code}\n${avatarError.message}`,
                    [{ text: 'OK' }]
                );
            }

        } catch (error) {
            addResult('General Test Failure', `Error: ${error.message}`);
        } finally {
            setIsLoading(false);
        }
    };

    const addResult = (testName, result) => {
        setTestResults(prev => [...prev, { testName, result, timestamp: new Date().toISOString() }]);
    };

    return (
        <View style={styles.container}>
            <Text style={styles.header}>Firebase Storage Diagnostics</Text>

            <View style={styles.buttonContainer}>
                <Button
                    title="Run Diagnostic Tests"
                    onPress={runTests}
                    disabled={isLoading}
                />
            </View>

            {isLoading && (
                <ActivityIndicator size="large" color="#4a6ea9" style={styles.loader} />
            )}

            <ScrollView style={styles.resultsContainer}>
                {testResults.map((test, index) => (
                    <View key={index} style={styles.resultItem}>
                        <Text style={styles.testName}>{test.testName}</Text>
                        <Text style={styles.testResult}>{test.result}</Text>
                        <Text style={styles.timestamp}>{test.timestamp}</Text>
                    </View>
                ))}
            </ScrollView>

            <View style={styles.buttonContainer}>
                <Button
                    title="Go Back"
                    onPress={() => navigation.goBack()}
                />
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 20,
        backgroundColor: '#f5f5f5',
    },
    header: {
        fontSize: 22,
        fontWeight: 'bold',
        marginBottom: 20,
        textAlign: 'center',
        color: '#333',
    },
    buttonContainer: {
        marginVertical: 15,
    },
    loader: {
        marginVertical: 20,
    },
    resultsContainer: {
        flex: 1,
        marginVertical: 10,
    },
    resultItem: {
        backgroundColor: '#fff',
        padding: 15,
        borderRadius: 5,
        marginBottom: 10,
        borderLeftWidth: 4,
        borderLeftColor: '#4a6ea9',
    },
    testName: {
        fontWeight: 'bold',
        fontSize: 16,
        marginBottom: 5,
        color: '#333',
    },
    testResult: {
        fontSize: 14,
        color: '#555',
    },
    timestamp: {
        fontSize: 12,
        color: '#999',
        marginTop: 5,
    },
}); 