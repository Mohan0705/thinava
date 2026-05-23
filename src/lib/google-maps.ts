'use client'

declare global {
  interface Window {
    google?: any
  }
}

let googleMapsPromise: Promise<any> | null = null

const GOOGLE_MAPS_SCRIPT_ID = 'thinava-google-maps-sdk'

const hasGoogleMaps = () => typeof window !== 'undefined' && Boolean(window.google?.maps)

export const resetGoogleMapsScript = () => {
  googleMapsPromise = null

  if (typeof document === 'undefined') {
    return
  }

  const existingScript = document.getElementById(GOOGLE_MAPS_SCRIPT_ID)
  if (existingScript) {
    existingScript.remove()
  }
}

export const loadGoogleMaps = async (apiKey: string) => {
  if (!apiKey || apiKey.includes('your-google-maps-api-key')) {
    throw new Error('Google Maps API key is missing.')
  }

  if (hasGoogleMaps()) {
    return window.google
  }

  if (googleMapsPromise) {
    return googleMapsPromise
  }

  googleMapsPromise = new Promise<any>((resolve, reject) => {
    const existingScript = document.getElementById(GOOGLE_MAPS_SCRIPT_ID) as HTMLScriptElement | null

    if (existingScript) {
      existingScript.addEventListener(
        'load',
        () => {
          if (hasGoogleMaps()) {
            resolve(window.google!)
            return
          }

          reject(new Error('Google Maps finished loading without the maps SDK.'))
        },
        { once: true }
      )
      existingScript.addEventListener('error', () => reject(new Error('Unable to load Google Maps.')), {
        once: true,
      })
      return
    }

    const script = document.createElement('script')
    script.id = GOOGLE_MAPS_SCRIPT_ID
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=geometry,places`
    script.async = true
    script.defer = true
    script.onload = () => {
      if (hasGoogleMaps()) {
        resolve(window.google!)
        return
      }

      reject(new Error('Google Maps finished loading without the maps SDK.'))
    }
    script.onerror = () => reject(new Error('Unable to load Google Maps.'))
    document.head.appendChild(script)
  }).catch((error) => {
    googleMapsPromise = null
    throw error
  })

  return googleMapsPromise
}
