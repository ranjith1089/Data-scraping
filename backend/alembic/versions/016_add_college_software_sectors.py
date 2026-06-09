"""Add college and software sectors (industry setup).

Revision ID: 016
Revises: 015
"""
from alembic import op

revision = "016"
down_revision = "015"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        INSERT INTO sectors (code, name, icon, description, ai_persona, pain_points, value_props)
        VALUES
        (
          'college',
          'Colleges & Universities',
          'GraduationCap',
          'Degree colleges, autonomous colleges, deemed universities, engineering & medical colleges, and professional institutions across India.',
          'Expert B2B sales consultant specializing in Colleges & Universities in India. You understand NAAC, NBA, and NIRF accreditation frameworks, academic calendar-driven budget cycles, UGC/AICTE compliance requirements, and the multi-stakeholder decision-making process in higher-education institutions.',
          ARRAY[
            'Student enrollment, engagement and retention challenges',
            'Placement and career outcome pressures',
            'NAAC / NBA / NIRF accreditation documentation overhead',
            'Digital transformation of campus operations and LMS adoption',
            'Alumni engagement, fundraising and industry connect'
          ],
          ARRAY[
            'Automates NAAC / NIRF documentation saving 100+ hours per cycle',
            'AI-driven student engagement workflows that improve retention',
            'Placement tracker with recruiter pipeline management',
            'Industry-ready curriculum gap analysis using job-market data',
            'Alumni engagement portal integrated with LinkedIn'
          ]
        ),
        (
          'software',
          'Software Products & SaaS',
          'Code2',
          'B2B and B2C software product companies, SaaS startups, ISVs, and product-led growth businesses across India.',
          'Expert B2B sales consultant specializing in Software Products & SaaS companies in India. You understand PLG and SLG motions, SaaS metrics (ARR, MRR, churn, CAC, LTV), product-market fit stages, and the competitive dynamics of Indian SaaS ecosystems like Zoho, Freshworks, and emerging SaaS-first startups.',
          ARRAY[
            'Scaling customer acquisition beyond founder networks and referrals',
            'High monthly churn hurting ARR growth',
            'Building a repeatable outbound sales motion',
            'Expanding from SMB to mid-market and enterprise accounts',
            'Competing with global SaaS players on limited marketing budgets'
          ],
          ARRAY[
            'AI-powered ICP scoring to prioritize the highest-converting leads',
            'Multi-channel outbound sequences tailored to SaaS buyer personas',
            'Churn prediction signals to trigger proactive retention campaigns',
            'Competitive battlecard generation for sales team enablement',
            'Pipeline analytics with ARR-weighted forecasting'
          ]
        )
        ON CONFLICT (code) DO NOTHING
        """
    )


def downgrade() -> None:
    op.execute(
        "DELETE FROM sectors WHERE code IN ('college', 'software')"
    )
