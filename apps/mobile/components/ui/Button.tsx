import React from 'react'
import { TouchableOpacity, Text, ActivityIndicator, TouchableOpacityProps } from 'react-native'

interface ButtonProps extends TouchableOpacityProps {
  title: string
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  fullWidth?: boolean
}

const VARIANT_STYLES = {
  primary: 'bg-souk-gold active:bg-souk-gold-light',
  secondary: 'bg-souk-charcoal border border-souk-muted active:bg-souk-black',
  ghost: 'bg-transparent border border-souk-muted-light active:bg-souk-sand',
  danger: 'bg-souk-error active:opacity-80',
}

const VARIANT_TEXT_STYLES = {
  primary: 'text-souk-black font-semibold',
  secondary: 'text-souk-white font-medium',
  ghost: 'text-souk-charcoal font-medium',
  danger: 'text-white font-semibold',
}

const SIZE_STYLES = {
  sm: 'px-3 py-2 rounded-lg',
  md: 'px-5 py-3 rounded-xl',
  lg: 'px-6 py-4 rounded-2xl',
}

const SIZE_TEXT_STYLES = {
  sm: 'text-sm',
  md: 'text-base',
  lg: 'text-lg',
}

export function Button({
  title,
  variant = 'primary',
  size = 'md',
  loading = false,
  fullWidth = false,
  disabled,
  className,
  ...props
}: ButtonProps) {
  const isDisabled = disabled || loading

  return (
    <TouchableOpacity
      className={`
        flex-row items-center justify-center
        ${VARIANT_STYLES[variant]}
        ${SIZE_STYLES[size]}
        ${fullWidth ? 'w-full' : ''}
        ${isDisabled ? 'opacity-50' : ''}
        ${className || ''}
      `}
      disabled={isDisabled}
      activeOpacity={0.8}
      {...props}
    >
      {loading && (
        <ActivityIndicator
          size="small"
          color={variant === 'primary' ? '#0F0E0E' : '#D4A853'}
          className="mr-2"
        />
      )}
      <Text className={`${VARIANT_TEXT_STYLES[variant]} ${SIZE_TEXT_STYLES[size]}`}>
        {title}
      </Text>
    </TouchableOpacity>
  )
}
