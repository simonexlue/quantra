import React from "react";
import { Text, View } from "react-native";

export default function FlagPill({ flag} : {flag: 'ok' | 'low' | 'out'}) {

    const bg = flag === 'ok' ? '#2e7d32' : flag === 'low' ? '#f9a825' : '#c62828';
    const fg = 'white';
    return (
        <View style={{
            backgroundColor: bg,
            paddingHorizontal: 6,
            paddingVertical: 2,
            borderRadius: 4,
            alignSelf: 'flex-start'
        }}>
            <Text style={{ color: fg, fontSize: 12, fontWeight: 'bold' }}>
                {flag.toUpperCase()}
            </Text>
        </View>
    )
}