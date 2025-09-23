using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace NaturalToQuery.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class setdatabasenameinprofile : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "DatabaseName",
                table: "Profiles",
                type: "TEXT",
                nullable: false,
                defaultValue: "");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "DatabaseName",
                table: "Profiles");
        }
    }
}
