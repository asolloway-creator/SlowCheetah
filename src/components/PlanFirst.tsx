import Link from 'next/link';

/**
 * Where you stand and Your deals before a visitor has a plan of their own
 * in this browser: put it in, or (`account`) sign in to the one they have.
 * The sample is a fixed position with no deals behind it, so these pages say
 * what they'll show instead of showing invented history.
 */
export default function PlanFirst({ page, account = false }: { page: 'quota' | 'history'; account?: boolean }) {
  return (
    <div className="plan-first">
      <h1 className="page-title">{page === 'quota' ? 'Where you stand' : 'Your deals'}</h1>
      <p className="plan-intro">
        {account
          ? page === 'quota'
            ? 'Your plan is in your account. Sign in to see your month and your quarter: how close your accelerator is, what you’ve earned, and what discounts have cost you.'
            : 'Your deals are in your account, with what each paid you and what its discount cost you. Sign in to see them.'
          : page === 'quota'
            ? 'Put your plan in and this page follows your month and your quarter as you book deals: how close your accelerator is, what you’ve earned, and what discounts have cost you.'
            : 'Every deal you book shows up here, with what it paid you and what its discount cost you. Put your plan in to start.'}
      </p>
      {account ? (
        <Link className="btn btn-primary btn-lg" href="/login">
          Sign in
        </Link>
      ) : (
        <Link className="btn btn-primary btn-lg" href="/?plan=1" scroll={false}>
          Put your plan in
        </Link>
      )}
    </div>
  );
}
