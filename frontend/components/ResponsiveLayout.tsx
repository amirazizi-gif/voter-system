import { ReactNode } from 'react'

interface ResponsiveLayoutProps {
  children: ReactNode
}

export default function ResponsiveLayout({ children }: ResponsiveLayoutProps) {
  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-gray-50">
      <div className="w-full max-w-7xl mx-auto px-2 sm:px-4 md:px-6 lg:px-8">
        {children}
      </div>
    </div>
  )
}