import React from "react";
import { Text } from "react-native-paper";

export default function FlagPill({ flag} : {flag: 'ok' | 'low' | 'out'}) {

    const bg = flag === 'ok' ? '#2e7d32' : flag === 'low' ? '#f9a825' : '#c62828';
    const fg = 'white';
    return (
        <Text>
            {flag.toUpperCase()}
        </Text>
    )
}