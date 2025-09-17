import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Button, Text, ActivityIndicator } from 'react-native-paper';
import { useSpeechToText } from '../hooks/useSpeechToText';

type Props = {
    // Called when user confirms their speech
    onConfirm: (text: string) => void;
}

export default function SpeechBar({ onConfirm }: Props ) {
    const { isListening, transcript, error, start, stop, reset} = useSpeechToText();

    return (
        <View style={styles.wrap}>
            <View style={styles.row}>
                <Text variant="titleMedium">Speak</Text>
                {isListening && <ActivityIndicator style={{marginLeft:8}}/>}
            </View>

            <View style={{ marginTop: 8}}>
                <Text variant="bodyMedium" style={styles.transcript}>
                    {transcript || (isListening ? "Listening..." : "Tap the mic and speak")}
                </Text>
                {!!error && <Text style={{color: "red", marginTop: 6}}>{error}</Text>}
            </View>

            <View style={styles.buttons}>
                {!isListening ? (
                    <Button mode="contained" onPress={start} icon="microphone">
                        Start
                    </Button>
                ) : (
                    <Button mode="contained" onPress={stop} icon="microphone-off">
                        Stop
                    </Button>
                )}

                <Button mode="text" onPress={reset}>
                    Clear
                </Button>

                <Button mode="contained-tonal" onPress={() => onConfirm(transcript.trim())}>
                    Use results
                </Button>
            </View>
        </View>
    )
}

const styles = StyleSheet.create({

    wrap: {
        padding: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: "#ddd",
        backgroundColor: "white"
    },

    row: {
        flexDirection: 'row',
        alignItems: 'center',
    },

    transcript : {
        minHeight: 40,
    },

    buttons: {
        flexDirection: "row",
        gap: 8,
        marginTop: 10, 
        alignItems: "center",
    }
});