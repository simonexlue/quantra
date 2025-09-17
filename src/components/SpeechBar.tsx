import React from 'react';
import { View, StyleSheet, Modal } from 'react-native';
import { Button, Text, ActivityIndicator, Portal } from 'react-native-paper';
import { useSpeechToText } from '../hooks/useSpeechToText';

type Props = {
    visible: boolean;
    onDismiss: () => void;
    onConfirm: (text: string) => void;
}

export default function SpeechModal({ visible, onDismiss, onConfirm }: Props ) {
    const { isListening, transcript, error, start, stop, reset} = useSpeechToText();

    const handleConfirm = () => {
        onConfirm(transcript.trim());
        reset();
        onDismiss();
    };

    const handleDismiss = () => {
        reset();
        onDismiss();
    };

    return (
        <Portal>
            <Modal
                visible={visible}
                onRequestClose={handleDismiss}
                animationType="fade"
                transparent={true}
            >
                <View style={styles.overlay}>
                    <View style={styles.popup}>
                        <View style={styles.header}>
                            <Text variant="headlineSmall">Voice Input</Text>
                            <Button mode="text" onPress={handleDismiss} icon="close">
                                Close
                            </Button>
                        </View>

                        <View style={styles.statusRow}>
                            <Text variant="bodyLarge">
                                {isListening ? "Listening..." : "Tap to start speaking"}
                            </Text>
                            {isListening && <ActivityIndicator style={{marginLeft:8}}/>}
                        </View>

                        <View style={styles.transcriptContainer}>
                            <Text variant="bodyMedium" style={styles.transcript}>
                                {transcript || "Your speech will appear here..."}
                            </Text>
                            {!!error && (
                                <Text style={styles.errorText}>
                                    {error}
                                </Text>
                            )}
                        </View>

                        <View style={styles.buttons}>
                            {!isListening ? (
                                <Button 
                                    mode="contained" 
                                    onPress={start} 
                                    icon="microphone"
                                    style={styles.mainButton}
                                >
                                    Start
                                </Button>
                            ) : (
                                <Button 
                                    mode="contained" 
                                    onPress={stop} 
                                    icon="microphone-off"
                                    style={styles.mainButton}
                                >
                                    Stop
                                </Button>
                            )}

                            <View style={styles.secondaryButtons}>
                                <Button mode="outlined" onPress={reset}>
                                    Clear
                                </Button>
                                <Button 
                                    mode="contained-tonal" 
                                    onPress={handleConfirm}
                                    disabled={!transcript.trim()}
                                >
                                    Use
                                </Button>
                            </View>
                        </View>
                    </View>
                </View>
            </Modal>
        </Portal>
    )
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    
    popup: {
        backgroundColor: '#fff',
        borderRadius: 16,
        width: '100%',
        maxWidth: 400,
        elevation: 8,
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 4,
        },
        shadowOpacity: 0.25,
        shadowRadius: 8,
    },
    
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#e0e0e0',
    },
    
    statusRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 8,
    },
    
    transcriptContainer: {
        padding: 16,
        backgroundColor: '#f8f9fa',
        margin: 16,
        borderRadius: 8,
        minHeight: 80,
        justifyContent: 'center',
    },
    
    transcript: {
        textAlign: 'center',
        lineHeight: 20,
        color: '#333',
    },
    
    errorText: {
        color: '#d32f2f',
        marginTop: 8,
        textAlign: 'center',
        fontSize: 14,
    },
    
    buttons: {
        padding: 16,
        gap: 12,
    },
    
    mainButton: {
        marginBottom: 8,
    },
    
    secondaryButtons: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: 12,
    },
});