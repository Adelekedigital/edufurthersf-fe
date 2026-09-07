import Image from 'next/image'

export function Brand() {
  return <span className="brand"><Image src="/edufurther-logo.svg" alt="Edufurther" width={314} height={60} priority /></span>
}
