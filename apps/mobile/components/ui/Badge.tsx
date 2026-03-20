import React from 'react'
import { View, Text } from 'react-native'

interface BadgeProps {
  label: string
  variant?: 'gold' | 'green' | 'red' | 'muted' | 'sand'
}

const VARIANT_STYLES = {
  gold: 'bg-souk-gold',
  green: 'bg-souk-success',
  red: 'bg-souk-error',
  muted: 'bg-souk-charcoal border border-souk-muted',
  sand: 'bg-souk-sand',
}

const VARIANT_TEXT = {
  gold: 'text-souk-black',
  green: 'text-white',
  red: 'text-white',
  muted: 'text-souk-muted-light',
  sand: 'text-souk-charcoal',
}

const CONDITION_LABELS: Record<string, { label: string; variant: BadgeProps['variant'] }> = {
  new_with_tags: { label: 'New with tags', variant: 'gold' },
  like_new: { label: 'Like new', variant: 'green' },
  excellent: { label: 'Excellent', variant: 'green' },
  good: { label: 'Good', variant: 'muted' },
  fair: { label: 'Fair', variant: 'muted' },
}

export function Badge({ label, variant = 'muted' }: BadgeProps) {
  return (
    <View className={`px-2 py-0.5 rounded-full ${VARIANT_STYLES[variant]}`}>
      <Text className={`text-xs font-medium ${VARIANT_TEXT[variant]}`}>{label}</Text>
    </View>
  )
}

export function ConditionBadge({ condition }: { condition: string }) {
  const config = CONDITION_LABELS[condition] ?? { label: condition, variant: 'muted' as const }
  return <Badge label={config.label} variant={config.variant} />
}
