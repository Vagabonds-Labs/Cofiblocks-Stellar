import { useEffect, RefObject } from 'react'

export function useOutsideClick(ref: RefObject<HTMLElement>, onClickOutside: () => void) {
    useEffect(() => {
      function handler(e: MouseEvent) {
        if (ref.current && !ref.current.contains(e.target as Node)) {
          onClickOutside()
        }
      }
      document.addEventListener('mousedown', handler)
      return () => document.removeEventListener('mousedown', handler)
    }, [ref, onClickOutside])
  }
  