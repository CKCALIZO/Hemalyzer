import { Header} from "../components/Header.jsx";
import { Footer } from "../components/Footer.jsx";

export const Reports = () => {
    return(
        <div className="flex flex-col min-h-screen">
            <Header />
            <main className="flex grow flex-col items-start justify-start p-8">
                <h1 className="text-5xl">Reports page</h1>
            </main>
            <Footer />
        </div>
    )
}