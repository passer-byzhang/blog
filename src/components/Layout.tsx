
import Footer  from "./Footer"
export default function Layout({
    children,
  }: {
    children: React.ReactNode
  }){
    return (
        <>
            {children}
          <Footer />
        </>
      )

}