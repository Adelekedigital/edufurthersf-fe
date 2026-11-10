// The EduFurther wordmark from the design system's logo asset group. It is a bitmap; never redraw it.
export function Brand() {
  // eslint-disable-next-line @next/next/no-img-element -- a fixed-size brand mark; next/image adds nothing here
  return <span className="brand"><img src="/edufurther-logo.png" width={1000} height={134} alt="EduFurther" /></span>
}
