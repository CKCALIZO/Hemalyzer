import { Header } from "../components/Header.jsx"
import { Footer } from "../components/Footer.jsx";


const Homepage = () => {
    return(
        <>
            <div className= "flex flex-col min-h-screen">
                <Header />
                <main className="flex grow flex-col items-start justify-start p-8">
                    <section className="grid grid-cols-2 gap-4 w-full grow">
                        <div>
                            <p>Upload here</p>
                        </div>
                        <div>
                            <p>Results here</p>
                        </div>
                    </section>
                </main>
                <Footer />
            </div>
        </>
    )
}
export default Homepage;