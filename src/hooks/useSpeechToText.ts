import { useCallback, useEffect, useRef, useState } from 'react';
import Voice, {
    SpeechResultsEvent,
    SpeechEndEvent,
    SpeechErrorEvent,
    SpeechStartEvent,
} from '@react-native-voice/voice';

export function useSpeechToText() {
    const [isListening, setIsListening] = useState(false);
    const [transcript, setTranscript] = useState('');
    const [error, setError] = useState<string | null>(null);

    // Holds most recent transcript pieces
    const fullTextRef = useRef("");

    // Handlers from native module

    // OS starts listening
    const onSpeechStart = useCallback((event: SpeechStartEvent) => {
        setIsListening(true);
        setError(null);
    }, []);

    // OS gives final words for the session
    const onSpeechResults = useCallback((event: SpeechResultsEvent) => {
        const value = (event.value ?? []).join(" ");
        fullTextRef.current = value;
        setTranscript(value);
    }, []);

    // OS stops listening
    const onSpeechEnd = useCallback((event: SpeechEndEvent) => {
        setIsListening(false);
    }, []);

    const onSpeechError = useCallback((event: SpeechErrorEvent) => {
        setIsListening(false);
        setError(event.error?.message ?? "Speech error");
    }, []);

    useEffect(() => {
        Voice.onSpeechStart = onSpeechStart;
        Voice.onSpeechResults = onSpeechResults;
        Voice.onSpeechEnd = onSpeechEnd;
        Voice.onSpeechError = onSpeechError;

        return () => {
            // Clean up native listeners
            Voice.destroy().catch(() => {});
            Voice.removeAllListeners();
        };
        
    }, [onSpeechStart, onSpeechResults, onSpeechEnd, onSpeechError]);

    const start = useCallback(async () => {
        setError(null);
        setTranscript("");
        fullTextRef.current = "";
        await Voice.start("en-US");
    }, []);

    // Tells OS to finalize and stop listening
    const stop = useCallback(async () => {
        await Voice.stop();
    }, []);

    // Fully cancel the session (no results)
    const cancel = useCallback(async () => {
        await Voice.cancel();
        setIsListening(false);
    }, []);

    const reset = useCallback(() => {
        setTranscript("");
        fullTextRef.current = "";
        setError(null);
    }, []);

    return {
        isListening,
        transcript,
        error,
        start,
        stop,
        cancel,
        reset,
    };
}