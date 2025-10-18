import { Header } from "../components/Header.jsx"
import { Footer } from "../components/Footer.jsx";


const Homepage = () => {
    return (
        <>
            <div className="flex flex-col min-h-screen">
                <Header />
                <main className="flex grow flex-col items-start justify-start p-8">
                    <section className="grid grid-cols-2 gap-4 w-full grow">
                        <div className="border border-gray-400 rounded-lg flex justify-center items-center flex-col">
                            <label htmlFor="pbs-upload" className="p-3 m-2 text-2xl">Upload Peripheral Blood Smear Image
                                <input className="block w-full mb-5 text-sm text-gray-900 border border-gray-300 
                                rounded-lg cursor-pointer bg-gray-50 focus:outline-none p-2 m-5"
                                    id="pbs-upload" type="file" />
                            </label>
                            <button className="text-white bg-[#cb2a49] backdrop-blur-sm border border-white/20
                            hover:bg-white/20 hover:border-white/30 transition-all duration-300 
                            focus:ring-4 focus:outline-none focus:ring-white/30 shadow-md hover:shadow-xl 
                            font-semibold rounded-lg text-base px-6 py-3 cursor-pointer">
                                Upload
                            </button>
                        </div>
                        <div className="border border-gray-400 rounded-lg">
                            <p className="p-3 m-2">Results here</p>
                        </div>
                    </section>
                </main>
                <Footer />
            </div>
        </>
    )
}
export default Homepage;