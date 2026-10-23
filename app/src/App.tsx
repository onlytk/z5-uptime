import Footer from "./components/Footer";
import Groups from "./components/Groups";
import Header from "./components/Header";
import Hero from "./components/Hero";
import Incidents from "./components/Incidents";
import Performance from "./components/Performance";
import { lastDays } from "./lib/history";
import { useHistory, useNow } from "./lib/hooks";

export default function App() {
  const { history, failed } = useHistory();
  const now = useNow();
  return (
    <>
      <Header />
      <main>
        <Hero history={history} failed={failed} now={now} />
        {history && (
          <div className="mx-auto max-w-[1000px] space-y-12 px-5 pb-24 sm:space-y-14">
            <Groups history={history} days={lastDays(now)} />
            <Performance history={history} now={now} />
            <Incidents history={history} now={now} />
          </div>
        )}
      </main>
      <Footer />
    </>
  );
}
