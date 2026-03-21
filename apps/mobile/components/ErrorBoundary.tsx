import React, { Component, type ReactNode } from 'react'
import { View, Text, TouchableOpacity } from 'react-native'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  private handleRetry = () => {
    this.setState({ hasError: false })
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={{ flex: 1, backgroundColor: '#0F0E0E', alignItems: 'center', justifyContent: 'center', padding: 32 }}>
          <Text style={{ color: '#FAFAFA', fontSize: 20, fontWeight: 'bold', marginBottom: 8 }}>
            Something went wrong
          </Text>
          <Text style={{ color: '#8A8A8A', textAlign: 'center', marginBottom: 24 }}>
            An unexpected error occurred. Please try again.
          </Text>
          <TouchableOpacity
            style={{ backgroundColor: '#D4A853', paddingHorizontal: 32, paddingVertical: 14, borderRadius: 12 }}
            onPress={this.handleRetry}
          >
            <Text style={{ color: '#0F0E0E', fontWeight: '600', fontSize: 16 }}>Try Again</Text>
          </TouchableOpacity>
        </View>
      )
    }

    return this.props.children
  }
}
