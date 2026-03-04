import streamlit as st
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go

st.set_page_config(
    page_title="ヘルプデスクダッシュボード",
    page_icon="🎫",
    layout="wide"
)

@st.cache_resource
def get_session():
    try:
        from snowflake.snowpark.context import get_active_session
        return get_active_session()
    except Exception as e:
        st.error(f"Snowflakeセッション取得エラー: {e}")
        return None

session = get_session()

if session is None:
    st.error("Snowflakeに接続できません。Snowsight上で実行してください。")
    st.stop()

st.title("🎫 スマート社内ヘルプデスク ダッシュボード")

@st.cache_data(ttl=60, show_spinner=False)
def get_kpi_summary():
    try:
        return session.sql("SELECT * FROM HELPDESK_DB.APP.TICKET_KPI_SUMMARY").to_pandas()
    except Exception as e:
        st.error(f"KPIデータ取得エラー: {e}")
        return pd.DataFrame()

@st.cache_data(ttl=60, show_spinner=False)
def get_tickets():
    try:
        return session.sql("""
            SELECT * FROM HELPDESK_DB.APP.HELPDESK_TICKETS_ICE
            ORDER BY created_at DESC
            LIMIT 100
        """).to_pandas()
    except Exception as e:
        st.error(f"チケットデータ取得エラー: {e}")
        return pd.DataFrame()

@st.cache_data(ttl=60, show_spinner=False)
def get_stats_by_location():
    try:
        return session.sql("SELECT * FROM HELPDESK_DB.APP.TICKET_STATS_BY_LOCATION").to_pandas()
    except Exception as e:
        st.error(f"拠点別統計取得エラー: {e}")
        return pd.DataFrame()

@st.cache_data(ttl=60, show_spinner=False)
def get_daily_stats():
    try:
        return session.sql("""
            SELECT * FROM HELPDESK_DB.APP.TICKET_STATS_DAILY
            WHERE ticket_date >= DATEADD('day', -30, CURRENT_DATE())
            ORDER BY ticket_date
        """).to_pandas()
    except Exception as e:
        st.error(f"日次統計取得エラー: {e}")
        return pd.DataFrame()

with st.spinner("データを読み込み中..."):
    kpi = get_kpi_summary()
    tickets = get_tickets()
    loc_stats = get_stats_by_location()
    daily_stats = get_daily_stats()

st.subheader("📊 KPIサマリー")

if not kpi.empty:
    col1, col2, col3, col4, col5 = st.columns(5)
    with col1:
        st.metric("総チケット数", int(kpi['TOTAL_TICKETS'].iloc[0]))
    with col2:
        st.metric("本日のチケット", int(kpi['TODAY_TICKETS'].iloc[0]))
    with col3:
        st.metric("対応中", int(kpi['OPEN_TICKETS'].iloc[0]) + int(kpi['IN_PROGRESS_TICKETS'].iloc[0]))
    with col4:
        st.metric("高緊急度", int(kpi['HIGH_URGENCY_TICKETS'].iloc[0]), delta_color="inverse")
    with col5:
        avg_res = kpi['AVG_RESOLUTION_MINUTES'].iloc[0]
        if pd.notna(avg_res):
            st.metric("平均解決時間", f"{int(avg_res)}分")
        else:
            st.metric("平均解決時間", "-")
else:
    st.warning("KPIデータがありません")

st.divider()

col_left, col_right = st.columns(2)

with col_left:
    st.subheader("🏢 拠点別チケット状況")
    if not loc_stats.empty:
        fig_loc = px.bar(
            loc_stats.groupby('LOCATION').agg({'TOTAL_TICKETS': 'sum', 'OPEN_TICKETS': 'sum'}).reset_index(),
            x='LOCATION',
            y=['TOTAL_TICKETS', 'OPEN_TICKETS'],
            barmode='group',
            labels={'value': 'チケット数', 'variable': 'ステータス', 'LOCATION': '拠点'},
            color_discrete_map={'TOTAL_TICKETS': '#636EFA', 'OPEN_TICKETS': '#EF553B'}
        )
        fig_loc.update_layout(height=300, margin=dict(l=20, r=20, t=20, b=20))
        st.plotly_chart(fig_loc, use_container_width=True)
    else:
        st.info("データがありません")

with col_right:
    st.subheader("📈 種別分布")
    if not tickets.empty and 'ISSUE_TYPE' in tickets.columns:
        issue_counts = tickets['ISSUE_TYPE'].value_counts()
        fig_pie = px.pie(
            values=issue_counts.values,
            names=issue_counts.index,
            color_discrete_sequence=px.colors.qualitative.Set2
        )
        fig_pie.update_layout(height=300, margin=dict(l=20, r=20, t=20, b=20))
        st.plotly_chart(fig_pie, use_container_width=True)
    else:
        st.info("データがありません")

st.subheader("📅 日次チケット推移（過去30日）")
if not daily_stats.empty:
    daily_agg = daily_stats.groupby('TICKET_DATE').agg({
        'TICKET_COUNT': 'sum',
        'RESOLVED_COUNT': 'sum'
    }).reset_index()
    fig_trend = go.Figure()
    fig_trend.add_trace(go.Scatter(
        x=daily_agg['TICKET_DATE'],
        y=daily_agg['TICKET_COUNT'],
        mode='lines+markers',
        name='新規チケット',
        line=dict(color='#636EFA')
    ))
    fig_trend.add_trace(go.Scatter(
        x=daily_agg['TICKET_DATE'],
        y=daily_agg['RESOLVED_COUNT'],
        mode='lines+markers',
        name='解決済み',
        line=dict(color='#00CC96')
    ))
    fig_trend.update_layout(
        height=300,
        margin=dict(l=20, r=20, t=20, b=20),
        xaxis_title="日付",
        yaxis_title="チケット数"
    )
    st.plotly_chart(fig_trend, use_container_width=True)
else:
    st.info("日次データがありません")

st.divider()
st.subheader("📋 最新チケット一覧")

col_filter1, col_filter2 = st.columns(2)
with col_filter1:
    status_filter = st.multiselect(
        "ステータスで絞り込み",
        options=['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'],
        default=['OPEN', 'IN_PROGRESS']
    )
with col_filter2:
    urgency_filter = st.multiselect(
        "緊急度で絞り込み",
        options=['HIGH', 'MEDIUM', 'LOW'],
        default=['HIGH', 'MEDIUM', 'LOW']
    )

if not status_filter:
    st.warning("ステータスを1つ以上選択してください")
elif not urgency_filter:
    st.warning("緊急度を1つ以上選択してください")
elif not tickets.empty:
    filtered = tickets[
        (tickets['STATUS'].isin(status_filter)) &
        (tickets['URGENCY'].isin(urgency_filter))
    ]
    
    if filtered.empty:
        st.info("条件に一致するチケットがありません")
    else:
        display_cols = ['TICKET_ID', 'REPORTER_NAME', 'LOCATION', 'ISSUE_TYPE', 
                       'URGENCY', 'SUMMARY', 'STATUS', 'CREATED_AT']
        existing_cols = [c for c in display_cols if c in filtered.columns]
        
        def highlight_urgency(row):
            if row.get('URGENCY') == 'HIGH':
                return ['background-color: #ffcccc'] * len(row)
            return [''] * len(row)
        
        st.dataframe(
            filtered[existing_cols].style.apply(highlight_urgency, axis=1),
            use_container_width=True,
            height=400
        )
        st.caption(f"表示件数: {len(filtered)} / {len(tickets)}")
else:
    st.info("チケットデータがありません")

st.divider()
with st.expander("📌 データソース情報"):
    st.markdown("""
    - **チケットデータ**: Snowflake Postgres → pg_lake → S3 → Iceberg Table
    - **更新頻度**: 5分ごと（pg_cron）
    - **参照テーブル**: `HELPDESK_DB.APP.HELPDESK_TICKETS_ICE`
    """)
    
    if st.button("🔄 キャッシュをクリア"):
        st.cache_data.clear()
        st.rerun()
