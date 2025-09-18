import plotly.express as px
import pandas as pd

class VisualizationManager:
    """Handles data visualization creation"""
    
    @staticmethod
    def create_visualization(df, query):
        """Create appropriate visualization based on data and query"""
        if df is None or df.empty or len(df.columns) < 2:
            return None
        
        try:
            query_lower = query.lower()
            
            # Take only first 20 rows for visualization
            df_viz = df.head(20)
            
            # Determine chart type based on query keywords and data structure
            if VisualizationManager._is_time_series(query_lower, df_viz):
                return VisualizationManager._create_line_chart(df_viz)
            
            elif VisualizationManager._is_top_analysis(query_lower):
                return VisualizationManager._create_bar_chart(df_viz, "Top Results")
            
            elif VisualizationManager._is_distribution_analysis(query_lower):
                if len(df_viz) <= 10:  # Only for small datasets
                    return VisualizationManager._create_pie_chart(df_viz)
                else:
                    return VisualizationManager._create_bar_chart(df_viz, "Distribution")
            
            else:
                # Default bar chart
                return VisualizationManager._create_bar_chart(df_viz, "Query Results")
        
        except Exception as e:
            print(f"Could not create visualization: {str(e)}")
            return None
    
    @staticmethod
    def _is_time_series(query_lower, df):
        """Check if query suggests time series analysis"""
        time_keywords = ['trend', 'time', 'month', 'year', 'day', 'date']
        return any(keyword in query_lower for keyword in time_keywords)
    
    @staticmethod
    def _is_top_analysis(query_lower):
        """Check if query is about top/highest/best items"""
        top_keywords = ['top', 'highest', 'best', 'most', 'maximum']
        return any(keyword in query_lower for keyword in top_keywords)
    
    @staticmethod
    def _is_distribution_analysis(query_lower):
        """Check if query is about distribution or counts"""
        dist_keywords = ['distribution', 'count', 'percentage', 'proportion']
        return any(keyword in query_lower for keyword in dist_keywords)
    
    @staticmethod
    def _create_line_chart(df):
        """Create a line chart for time series data"""
        fig = px.line(df, x=df.columns[0], y=df.columns[1], 
                     title="Trend Analysis")
        VisualizationManager._style_chart(fig)
        return fig
    
    @staticmethod
    def _create_bar_chart(df, title):
        """Create a bar chart"""
        fig = px.bar(df, x=df.columns[0], y=df.columns[1], title=title)
        fig.update_xaxes(tickangle=45)
        VisualizationManager._style_chart(fig)
        return fig
    
    @staticmethod
    def _create_pie_chart(df):
        """Create a pie chart for distribution"""
        fig = px.pie(df, names=df.columns[0], values=df.columns[1],
                   title="Distribution")
        VisualizationManager._style_chart(fig)
        return fig
    
    @staticmethod
    def _style_chart(fig):
        """Apply consistent styling to charts"""
        fig.update_layout(
            template="plotly_white",
            font=dict(size=12),
            title_font_size=16,
            showlegend=True
        )
        return fig
    
    @staticmethod
    def get_supported_chart_types():
        """Get list of supported chart types"""
        return [
            "Line Chart (Time Series)",
            "Bar Chart (Categorical Data)",
            "Pie Chart (Distribution)",
            "Scatter Plot (Correlation)",
            "Histogram (Frequency)"
        ]
    
    @staticmethod
    def export_chart_config(fig):
        """Export chart configuration for reuse"""
        if fig is None:
            return None
        
        return {
            'chart_type': fig.data[0].type,
            'layout': fig.layout,
            'data_columns': len(fig.data[0].x) if hasattr(fig.data[0], 'x') else 0
        }