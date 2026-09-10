import Link from 'next/link';

export default function Hero() {
  return (
    <div className="hero">
      <div className="hero-kicker">For reps who want the whole number</div>
      <h1 className="hero-title">
        See the whole deal <span className="hero-accent">before the offer is made.</span>
      </h1>
      <p className="hero-sub">
        Your comp plan, your quota and your accelerator, live on every deal you build. Drag a discount and
        watch exactly what it costs you &mdash; before you say the number out loud.
      </p>
      <div className="steps">
        <Link href="/plan" className="step">
          <span className="step-n">1</span>
          <span><span className="step-t">Set your plan</span><span className="step-d">Pick the shape closest to yours and put in your numbers. Two minutes.</span></span>
        </Link>
        <Link href="/quota" className="step">
          <span className="step-n">2</span>
          <span><span className="step-t">See where you stand</span><span className="step-d">Quota, accelerator, and what crossing it is worth right now.</span></span>
        </Link>
        <span className="step">
          <span className="step-n">3</span>
          <span><span className="step-t">Build the deal below</span><span className="step-d">Commission, quota credit, and every dollar a discount would cost you.</span></span>
        </span>
      </div>
    </div>
  );
}
