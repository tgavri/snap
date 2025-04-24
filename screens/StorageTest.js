import React, { useState } from 'react';
import { View, Button, Text, Alert } from 'react-native';
import { storage } from '../firebase';
import { ref, uploadBytes, uploadString, getDownloadURL } from 'firebase/storage';

export default function StorageTest() {
    const [isUploading, setIsUploading] = useState(false);
    const [result, setResult] = useState('');

    // Test 1: Simple string upload
    const testStringUpload = async () => {
        setIsUploading(true);
        setResult('Starting string upload test...');

        try {
            // Create a simple text file
            const testString = 'Hello Firebase Storage ' + new Date().toISOString();
            const storageRef = ref(storage, 'test/string-test.txt');

            // Upload string
            const uploadResult = await uploadString(storageRef, testString);
            console.log('String upload successful:', uploadResult);

            // Get URL
            const downloadURL = await getDownloadURL(uploadResult.ref);
            console.log('String file available at', downloadURL);

            setResult(`String upload success! URL: ${downloadURL}`);
            Alert.alert('Success', 'String upload worked!');
        } catch (error) {
            console.error('Error in string upload test:', error);
            setResult(`String upload error: ${error.message}`);
            Alert.alert('Error', `String upload failed: ${error.message}`);
        } finally {
            setIsUploading(false);
        }
    };

    // Test 2: Base64 image upload
    const testBase64Upload = async () => {
        setIsUploading(true);
        setResult('Starting base64 image upload test...');

        try {
            // A tiny 1x1 pixel transparent PNG as base64
            const tinyImageBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
            const storageRef = ref(storage, 'test/base64-test.png');

            // Upload base64 data
            const uploadResult = await uploadString(storageRef, tinyImageBase64, 'base64');
            console.log('Base64 upload successful:', uploadResult);

            // Get URL
            const downloadURL = await getDownloadURL(uploadResult.ref);
            console.log('Base64 file available at', downloadURL);

            setResult(`Base64 upload success! URL: ${downloadURL}`);
            Alert.alert('Success', 'Base64 upload worked!');
        } catch (error) {
            console.error('Error in base64 upload test:', error);
            setResult(`Base64 upload error: ${error.message}`);
            Alert.alert('Error', `Base64 upload failed: ${error.message}`);
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
            <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 20 }}>
                Firebase Storage Test
            </Text>

            <Button
                title="Test String Upload"
                onPress={testStringUpload}
                disabled={isUploading}
            />

            <View style={{ height: 20 }} />

            <Button
                title="Test Base64 Image Upload"
                onPress={testBase64Upload}
                disabled={isUploading}
            />

            <View style={{ height: 30 }} />

            <Text style={{ textAlign: 'center' }}>
                {isUploading ? 'Uploading...' : result}
            </Text>
        </View>
    );
} 