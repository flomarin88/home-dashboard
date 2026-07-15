import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { Sparkline } from './Sparkline'

describe('Sparkline', () => {
  it('draws the trend path and the dashed threshold line', () => {
    const { container } = render(
      <Sparkline values={[20, 22, 26]} threshold={24} />,
    )
    expect(container.querySelector('path')).toBeInTheDocument()
    const line = container.querySelector('line')
    expect(line).toBeInTheDocument()
    expect(line?.getAttribute('stroke-dasharray')).toBe('3 3')
  })

  it('renders nothing with fewer than two points', () => {
    const { container } = render(<Sparkline values={[]} threshold={26} />)
    expect(container.querySelector('svg')).toBeNull()
  })
})
