import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { Skeleton } from './Skeleton'

describe('Skeleton', () => {
  it('renders a pulsing placeholder with the passed sizing classes', () => {
    const { container } = render(<Skeleton className="h-6 w-20" />)
    const el = container.querySelector('.animate-pulse')
    expect(el).toBeInTheDocument()
    expect(el).toHaveClass('h-6', 'w-20')
  })
})
