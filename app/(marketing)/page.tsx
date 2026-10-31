import "./landing.css";
import { LANDING_HTML } from "./landing-html";
import LandingEffects from "./LandingEffects";
import ContactDialog from "./ContactDialog";

export default function Home() {
  return (
    <>
      <div dangerouslySetInnerHTML={{ __html: LANDING_HTML }} />
      <LandingEffects />
      <ContactDialog />
    </>
  );
}
