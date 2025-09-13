import React, { useState } from "react";
import { View, StyleSheet } from "react-native";
import { TextInput, Button, Text, useTheme } from "react-native-paper";
import { auth } from "../services/firebase";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from "@react-native-firebase/auth";

export default function LoginScreen() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState<string|null>(null);
    const theme = useTheme();

    const signIn = async () => {
        try {
            await signInWithEmailAndPassword(auth,email, password);
        } catch (e:any) {
            setError(e.message);
        }
    };

    // Sign Up Feature - Optional
    // const signUp = async () => {
    //     try {
    //         await createUserWithEmailAndPassword(auth,email, password);
    //     } catch (e:any) {
    //         setError(e.message);
    //     }
    // };

    return (
        <View style={styles.container}>
            <View style={styles.content}>
                <Text variant="headlineSmall" style={styles.title}>Sign In</Text>
                <TextInput 
                    label="Email" 
                    autoCapitalize="none" 
                    value={email} 
                    onChangeText={setEmail} 
                    mode="outlined"
                    style={styles.input}
                    theme={{
                        ...theme,
                        roundness: 15,
                    }}
                />
                <TextInput 
                    label="Password" 
                    autoCapitalize="none" 
                    value={password} 
                    onChangeText={setPassword} 
                    mode="outlined"
                    secureTextEntry
                    style={styles.input}
                    theme={{
                        ...theme,
                        roundness: 15,
                    }}
                />
                {error && <Text style={styles.error}>{error}</Text>}
                <Button 
                    mode="contained" 
                    onPress={signIn} 
                    style={styles.button}
                    theme={{
                        ...theme,
                        roundness: 15,
                    }}
                >
                    Sign In
                </Button>

                {/* Sign Up Feature - Optional*/}
                {/* <Button onPress={signUp}>Create Account</Button> */}
            </View>
        </View>
    )
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f5f5f5',
    },
    content: {
        flex: 1,
        justifyContent: 'center',
        padding: 40,
        gap: 16,
    },
    title: {
        textAlign: 'center',
        marginBottom: 10,
        color: '#333',
    },
    input: {
        marginBottom: 6,
    },
    button: {
        marginTop: 16,
    },
    error: {
        color: 'red',
        textAlign: 'center',
        marginTop: 8,
    },
});