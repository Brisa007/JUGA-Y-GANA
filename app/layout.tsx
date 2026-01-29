import './styles/globals.css'
import { ThemeProvider } from '@/theme-provider'

export const metadata = {
  title: 'Juga y Gana',
  description: 'Proyecto'
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        <ThemeProvider attribute="class">
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}