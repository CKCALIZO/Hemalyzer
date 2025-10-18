import { Header} from "../components/Header.jsx";
import { Footer } from "../components/Footer.jsx";

export const About = () => {
    return(
        <div className="flex flex-col min-h-screen">
            <Header />
            <main className="flex grow flex-col items-start justify-start p-8">
                <h1 className="text-4xl">About page</h1>
                <p className="my-4 p-3">Hemalyzer is a thesis project designed to assist in the classification of 
                    hematological diseases, particularly leukemia and its subtypes 
                    (AML, ALL, CML, CLL), using NAS-optimized YOLOv8 with attention-enhanced 
                    feature pyramids for ConvNeXt classification
                </p>
            </main>
            <Footer />
        </div>
    )
}