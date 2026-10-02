import Link from 'next/link';

/**
 * Where you stand and Your deals before a visitor has a plan of their own.
 * The sample is a fixed position with no deals behind it, so these pages say
 * what they'll show instead of showing invented history.
 */
export default function PlanFirst({ page }: { page: 'quota' | 'history' }) {
  return (
    <div className="plan-first">
      <h1 className="page-title">{page === 'quota' ? 'Where you stand' : 'Your deals'}</h1>
      <p className="plan-intro">
        {page === 'quota'
          ? 'Put your plan in and this page follows your month and your quarter as you book deals: how close your accelerator is, what you’ve earned, and what discounts have cost you.'
          : 'Every deal you book shows up here, with what it paid you and what its discount cost you. Put your plan in to start.'}
      </p>
      <Link className="btn btn-primary btn-lg" href="/?plan=1" scroll={false}>
        Put your plan in
      </Link>
    </div>
  );
}
