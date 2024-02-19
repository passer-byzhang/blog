
import Image from "next/image"
import AlvanImage from '../public/images/Alvan.jpg'
import ContactButtons from "./ContactButtons"
export default function Avator(){
    //console.log("path: "+ JSON.stringify(AlvanImage))
    return(
        <div id="Alvan" className="flex justify-center justify-center items-center mt-20">
                <Image className="me-8" src="/images/Alvan.jpg" width={100} height={100} style={{ borderRadius: '50%', overflow: 'hidden' }} alt="Alvan" />
                <div style={{ width: 200, height: 100 }}>
                    <p className="text-xl font-bold mt-2">Alvan</p>
                    <p className="mt-2">Smart contract developer in Shanghai</p>
                    <ContactButtons/>
                </div>
        </div>
    )


}

export function SideAvator(){
    
}